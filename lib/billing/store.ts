import { randomUUID } from "crypto";
import { readJsonFile, writeJsonFile } from "@/lib/storage/json";

const FILE = "billing.json";

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

export async function getInvoices(): Promise<BillingInvoice[]> {
  return readJsonFile<BillingInvoice[]>(FILE, []);
}

async function saveInvoices(items: BillingInvoice[]) {
  await writeJsonFile(FILE, items);
}

export async function findInvoice(id: string): Promise<BillingInvoice | null> {
  const invoices = await getInvoices();
  return invoices.find((invoice) => invoice.id === id) ?? null;
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

export async function addInvoice(payload: CreateInvoicePayload): Promise<BillingInvoice> {
  const existing = await getInvoices();
  const now = new Date().toISOString();

  const lines: BillingLineItem[] = payload.line_items.map((line) => ({
    id: randomUUID(),
    description: line.description,
    quantity: Math.max(0, Number(line.quantity) || 0),
    unit_price: roundCurrency(Math.max(0, Number(line.unit_price) || 0)),
  }));

  const payments: BillingPayment[] = [];
  const { total, balance } = computeTotals(lines, payments);

  const dueDate = normalizeDate(payload.due_date);

  const invoice: BillingInvoice = {
    id: randomUUID(),
    invoice_number: generateInvoiceNumber(),
    patient_id: payload.patient_id,
    due_date: dueDate,
    status: deriveStatus(total, balance, dueDate),
    notes: payload.notes?.trim() ? payload.notes.trim() : null,
    total,
    balance,
    created_at: now,
    updated_at: now,
    line_items: lines,
    payments,
  };

  existing.unshift(invoice);
  await saveInvoices(existing);
  return invoice;
}

export async function recordPayment(
  invoiceId: string,
  payload: PaymentPayload
): Promise<BillingInvoice | null> {
  const invoices = await getInvoices();
  const idx = invoices.findIndex((invoice) => invoice.id === invoiceId);
  if (idx === -1) return null;

  const current = invoices[idx];
  const payment: BillingPayment = {
    id: randomUUID(),
    amount: roundCurrency(Math.max(0, payload.amount)),
    method: payload.method?.trim() ? payload.method.trim() : null,
    reference: payload.reference?.trim() ? payload.reference.trim() : null,
    paid_at: normalizeDate(payload.paid_at),
  };

  const payments = [...current.payments, payment];
  const { total, balance } = computeTotals(current.line_items, payments);
  const updated: BillingInvoice = {
    ...current,
    payments,
    total,
    balance,
    status: deriveStatus(total, balance, current.due_date),
    updated_at: new Date().toISOString(),
  };

  invoices[idx] = updated;
  await saveInvoices(invoices);
  return updated;
}
