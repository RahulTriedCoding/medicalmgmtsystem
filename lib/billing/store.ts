import { randomUUID } from "crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";

export type BillingStatus = "pending" | "paid" | "overdue" | "partial";

export type BillingLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

export type BillingPayment = {
  id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  paid_at: string;
};

export type BillingInvoice = {
  id: string;
  invoice_number: string;
  patient_id: string;
  due_date: string;
  status: BillingStatus;
  notes: string | null;
  total: number;
  balance: number;
  created_at: string;
  updated_at: string;
  line_items: BillingLineItem[];
  payments: BillingPayment[];
};

export type CreateInvoicePayload = {
  patient_id: string;
  due_date: string;
  notes?: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
};

export type PaymentPayload = {
  amount: number;
  method?: string | null;
  reference?: string | null;
  paid_at?: string | null;
};

type ServerClient = SupabaseClient;

type InvoiceLineRow = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type InvoicePaymentRow = {
  id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  paid_at: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  patient_id: string;
  due_date: string;
  status: BillingStatus;
  notes: string | null;
  total: number;
  balance: number;
  created_at: string;
  updated_at: string;
  line_items?: InvoiceLineRow[] | null;
  payments?: InvoicePaymentRow[] | null;
};

async function ensureClient(client?: ServerClient) {
  return client ?? (await createSupabaseServerClient());
}

function isTableMissing(error?: PostgrestError | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "42P01" || /Could not find (the )?table/i.test(message);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function computeTotals(
  lineItems: BillingLineItem[],
  payments: BillingPayment[]
) {
  const total = lineItems.reduce((sum, line) => {
    const qty = Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0;
    const price = Number.isFinite(line.unit_price) ? Math.max(0, line.unit_price) : 0;
    return sum + qty * price;
  }, 0);

  const paid = payments.reduce((sum, payment) => {
    const amt = Number.isFinite(payment.amount) ? Math.max(0, payment.amount) : 0;
    return sum + amt;
  }, 0);

  const balance = Math.max(0, total - paid);
  return {
    total: roundCurrency(total),
    paid: roundCurrency(paid),
    balance: roundCurrency(balance),
  };
}

function deriveStatus(total: number, balance: number, dueDate: string): BillingStatus {
  if (balance <= 0.01) {
    return "paid";
  }

  const now = Date.now();
  const due = Date.parse(dueDate);
  const paidPortion = total - balance;

  if (!Number.isNaN(due) && due < now) {
    return "overdue";
  }

  if (paidPortion > 0.01) {
    return "partial";
  }

  return "pending";
}

function generateInvoiceNumber() {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("");
  const suffix = randomUUID().split("-")[0].toUpperCase();
  return `INV-${stamp}-${suffix}`;
}

function normalizeDate(value?: string | null) {
  if (!value) return new Date().toISOString();
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return new Date().toISOString();
  }
  return dt.toISOString();
}

function normalizeInvoiceRow(row: InvoiceRow): BillingInvoice {
  return {
    id: row.id,
    invoice_number: row.invoice_number,
    patient_id: row.patient_id,
    due_date: row.due_date,
    status: row.status,
    notes: row.notes ?? null,
    total: Number(row.total ?? 0),
    balance: Number(row.balance ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    line_items: (row.line_items ?? []).map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity ?? 0),
      unit_price: Number(line.unit_price ?? 0),
    })),
    payments: (row.payments ?? []).map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount ?? 0),
      method: payment.method ?? null,
      reference: payment.reference ?? null,
      paid_at: payment.paid_at,
    })),
  };
}

export async function getInvoices(
  client?: ServerClient
): Promise<BillingInvoice[]> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("billing_invoices")
    .select(
      `
        id,
        invoice_number,
        patient_id,
        due_date,
        status,
        notes,
        total,
        balance,
        created_at,
        updated_at,
        line_items:billing_invoice_items (
          id,
          description,
          quantity,
          unit_price
        ),
        payments:billing_payments (
          id,
          amount,
          method,
          reference,
          paid_at
        )
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissing(error)) {
      throw new Error("Billing tables are missing from the Supabase project.");
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as InvoiceRow[];
  return rows.map(normalizeInvoiceRow);
}

export async function findInvoice(
  id: string,
  client?: ServerClient
): Promise<BillingInvoice | null> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("billing_invoices")
    .select(
      `
        id,
        invoice_number,
        patient_id,
        due_date,
        status,
        notes,
        total,
        balance,
        created_at,
        updated_at,
        line_items:billing_invoice_items (
          id,
          description,
          quantity,
          unit_price
        ),
        payments:billing_payments (
          id,
          amount,
          method,
          reference,
          paid_at
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    if (isTableMissing(error)) {
      throw new Error("Billing tables are missing from the Supabase project.");
    }
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return normalizeInvoiceRow(data as InvoiceRow);
}

export async function addInvoice(
  payload: CreateInvoicePayload,
  client?: ServerClient
): Promise<BillingInvoice> {
  const supabase = await ensureClient(client);
  const { staffId } = await getCurrentStaffContext(supabase);
  const sanitizedLines: BillingLineItem[] = payload.line_items.map((line) => ({
    id: randomUUID(),
    description: line.description.trim(),
    quantity: Math.max(0, Number(line.quantity) || 0),
    unit_price: roundCurrency(Math.max(0, Number(line.unit_price) || 0)),
  }));

  const payments: BillingPayment[] = [];
  const { total, balance } = computeTotals(sanitizedLines, payments);
  const dueDate = normalizeDate(payload.due_date);
  const status = deriveStatus(total, balance, dueDate);

  const { data: inserted, error } = await supabase
    .from("billing_invoices")
    .insert({
      invoice_number: generateInvoiceNumber(),
      patient_id: payload.patient_id,
      due_date: dueDate,
      status,
      notes: payload.notes?.trim() ? payload.notes.trim() : null,
      total,
      balance,
      created_by: staffId,
      updated_by: staffId,
    })
    .select("id")
    .single();

  if (error) {
    if (isTableMissing(error)) {
      throw new Error("Billing tables are missing from the Supabase project.");
    }
    throw new Error(error.message);
  }

  const invoiceId = inserted.id as string;
  const { error: lineError } = await supabase
    .from("billing_invoice_items")
    .insert(
      sanitizedLines.map((line) => ({
        id: line.id,
        invoice_id: invoiceId,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        created_by: staffId,
      }))
    );

  if (lineError) {
    if (isTableMissing(lineError)) {
      throw new Error("Billing tables are missing from the Supabase project.");
    }
    throw new Error(lineError.message);
  }

  const invoice = await findInvoice(invoiceId, supabase);
  if (!invoice) {
    throw new Error("Invoice not found after creation");
  }
  return invoice;
}

export async function recordPayment(
  invoiceId: string,
  payload: PaymentPayload,
  client?: ServerClient
): Promise<BillingInvoice | null> {
  const supabase = await ensureClient(client);
  const { staffId } = await getCurrentStaffContext(supabase);
  const invoice = await findInvoice(invoiceId, supabase);
  if (!invoice) return null;

  const payment: BillingPayment = {
    id: randomUUID(),
    amount: roundCurrency(Math.max(0, payload.amount)),
    method: payload.method?.trim() ? payload.method.trim() : null,
    reference: payload.reference?.trim() ? payload.reference.trim() : null,
    paid_at: normalizeDate(payload.paid_at),
  };

  const updatedPayments = [...invoice.payments, payment];
  const { total, balance } = computeTotals(invoice.line_items, updatedPayments);
  const nextStatus = deriveStatus(total, balance, invoice.due_date);

  const { error: paymentError } = await supabase.from("billing_payments").insert({
    id: payment.id,
    invoice_id: invoiceId,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    paid_at: payment.paid_at,
    created_by: staffId,
  });

  if (paymentError) {
    if (isTableMissing(paymentError)) {
      throw new Error("Billing tables are missing from the Supabase project.");
    }
    throw new Error(paymentError.message);
  }

  const { error: updateError } = await supabase
    .from("billing_invoices")
    .update({
      total,
      balance,
      status: nextStatus,
      updated_by: staffId,
    })
    .eq("id", invoiceId);

  if (updateError) {
    if (isTableMissing(updateError)) {
      throw new Error("Billing tables are missing from the Supabase project.");
    }
    throw new Error(updateError.message);
  }

  return findInvoice(invoiceId, supabase);
}
