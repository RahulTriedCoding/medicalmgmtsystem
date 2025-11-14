import type { SupabaseClient } from "@supabase/supabase-js";
import { readJsonFile } from "@/lib/storage/json";
import type { BillingInvoice } from "@/lib/billing/store";

const LEGACY_FILE = "billing.json";

export type BillingMigrationResult = {
  totalLegacyInvoices: number;
  alreadyInSupabase: number;
  migrated: number;
  skipped: Array<{ id: string; reason: string }>;
};

export type BillingMigrationOptions = {
  supabase: SupabaseClient;
};

function toDateOnly(value: string | null | undefined) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export async function migrateLegacyBillingData(
  options: BillingMigrationOptions
): Promise<BillingMigrationResult> {
  const { supabase } = options;
  if (!supabase) {
    throw new Error("Supabase client is required to migrate billing data.");
  }

  const legacyInvoices = await readJsonFile<BillingInvoice[]>(LEGACY_FILE, []);
  const totalLegacyInvoices = legacyInvoices.length;

  const result: BillingMigrationResult = {
    totalLegacyInvoices,
    alreadyInSupabase: 0,
    migrated: 0,
    skipped: [],
  };

  if (legacyInvoices.length === 0) {
    return result;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("billing_invoices")
    .select("id");

  if (existingError) {
    throw new Error(`Failed to read existing billing invoices: ${existingError.message}`);
  }

  const existingIds = new Set((existingRows ?? []).map((row) => row.id));

  for (const invoice of legacyInvoices) {
    if (existingIds.has(invoice.id)) {
      result.alreadyInSupabase += 1;
      continue;
    }

    const invoiceRecord = {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      patient_id: invoice.patient_id,
      due_date: toDateOnly(invoice.due_date),
      status: invoice.status,
      notes: invoice.notes,
      total: Number(invoice.total ?? 0),
      balance: Number(invoice.balance ?? 0),
      created_at: invoice.created_at,
      updated_at: invoice.updated_at ?? invoice.created_at,
      created_by: null,
      updated_by: null,
    };

    const { error: invoiceError } = await supabase
      .from("billing_invoices")
      .upsert(invoiceRecord, { onConflict: "id" });

    if (invoiceError) {
      result.skipped.push({
        id: invoice.id,
        reason: `invoice insert failed: ${invoiceError.message}`,
      });
      continue;
    }

    const lineItems = (invoice.line_items ?? []).map((line) => ({
      id: line.id,
      invoice_id: invoice.id,
      description: line.description,
      quantity: Number(line.quantity ?? 0),
      unit_price: Number(line.unit_price ?? 0),
      created_at: invoice.created_at,
      created_by: null,
    }));

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("billing_invoice_items")
        .upsert(lineItems, { onConflict: "id" });

      if (lineError) {
        await supabase.from("billing_invoices").delete().eq("id", invoice.id);
        result.skipped.push({
          id: invoice.id,
          reason: `line item insert failed: ${lineError.message}`,
        });
        continue;
      }
    }

    const payments = (invoice.payments ?? []).map((payment) => ({
      id: payment.id,
      invoice_id: invoice.id,
      amount: Number(payment.amount ?? 0),
      method: payment.method,
      reference: payment.reference,
      paid_at: payment.paid_at ?? invoice.updated_at ?? new Date().toISOString(),
      created_at: payment.paid_at ?? invoice.updated_at ?? new Date().toISOString(),
      created_by: null,
    }));

    if (payments.length > 0) {
      const { error: paymentError } = await supabase
        .from("billing_payments")
        .upsert(payments, { onConflict: "id" });

      if (paymentError) {
        await supabase.from("billing_invoice_items").delete().eq("invoice_id", invoice.id);
        await supabase.from("billing_invoices").delete().eq("id", invoice.id);
        result.skipped.push({
          id: invoice.id,
          reason: `payment insert failed: ${paymentError.message}`,
        });
        continue;
      }
    }

    result.migrated += 1;
  }

  return result;
}
