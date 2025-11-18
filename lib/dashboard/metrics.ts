import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { BillingStatus } from "@/lib/billing/store";
import type { StaffRole } from "@/lib/staff/types";
import { startPerf, endPerf } from "@/lib/perf";

function startTimer(label: string) {
  return startPerf(label);
}

function endTimer(timer?: string | null) {
  endPerf(timer);
}

type AppointmentPerson = { full_name: string | null; mrn?: string | null };

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reason: string | null;
  patients?: AppointmentPerson | AppointmentPerson[] | null;
  doctors?: AppointmentPerson | AppointmentPerson[] | null;
};

type DashboardAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reason: string | null;
  patient_name: string;
  patient_mrn: string | null;
  doctor_name: string;
};

type DashboardInvoice = {
  id: string;
  invoice_number: string;
  patient_name: string;
  balance: number;
  due_date: string;
  status: BillingStatus;
};

type DashboardInventoryAlert = {
  id: string;
  name: string;
  quantity: number;
  lowStockThreshold?: number;
};

export type DashboardMetrics = {
  totalPatients: number;
  totalDoctors: number;
  todaysAppointmentsCount: number;
  outstandingBalance: number;
  overdueBalance: number;
  lowStockCount: number;
  upcomingAppointments: DashboardAppointment[];
  topInvoices: DashboardInvoice[];
  lowStockItems: DashboardInventoryAlert[];
};

function isAppointmentRow(value: unknown): value is AppointmentRow {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AppointmentRow>;
  return (
    typeof record.id === "string" &&
    typeof record.starts_at === "string" &&
    typeof record.ends_at === "string" &&
    typeof record.status === "string"
  );
}

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function isTableMissing(error?: PostgrestError | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "42P01" || /does not exist/i.test(message);
}

type MinimalInvoiceRow = {
  id: string;
  invoice_number: string;
  patient_id: string;
  due_date: string;
  status: BillingStatus;
  balance: number;
};

async function fetchOutstandingInvoices(
  supabase: SupabaseClient
): Promise<MinimalInvoiceRow[]> {
  const timer = startTimer("[perf] dashboard:fetchOutstandingInvoices");
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, patient_id, due_date, status, balance")
    .gt("balance", 0);
  endTimer(timer);

  if (error) {
    if (isTableMissing(error)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as MinimalInvoiceRow[];
}

type InventoryRow = {
  id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number | null;
};

type LowStockResult = {
  items: InventoryRow[];
  count: number;
};

async function fetchLowStockInventory(
  supabase: SupabaseClient
): Promise<LowStockResult> {
  const label = "[perf] dashboard:fetchLowStockInventory";
  const timer = startTimer(label);
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, quantity, low_stock_threshold")
    .order("quantity", { ascending: true });
  endTimer(timer);

  if (error) {
    if (isTableMissing(error)) {
      return { items: [], count: 0 };
    }
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? ((data as unknown[]) as InventoryRow[]) : [];
  const lowStock = rows.filter(
    (row) => typeof row.low_stock_threshold === "number" && row.quantity <= row.low_stock_threshold
  );
  return { items: lowStock, count: lowStock.length };
}

const DOCTOR_ROLE: StaffRole = "doctor";

export async function fetchDashboardData(supabase: SupabaseClient): Promise<DashboardMetrics> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);
  const now = new Date();

  const parallelLabel = "[perf] dashboard:parallelQueries";
  const parallelTimer = startTimer(parallelLabel);
  const [
    patientsQuery,
    doctorsQuery,
    todaysAppointmentsQuery,
    upcomingAppointmentsQuery,
    invoices,
    inventoryResult,
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", DOCTOR_ROLE),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", todayStart.toISOString())
      .lt("starts_at", todayEnd.toISOString())
      .neq("status", "cancelled"),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, reason, " +
          "patients:patient_id(full_name, mrn), doctors:doctor_id(full_name)"
      )
      .gte("starts_at", now.toISOString())
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(5),
    fetchOutstandingInvoices(supabase),
    fetchLowStockInventory(supabase),
  ]);
  endTimer(parallelTimer);

  const totalPatients = patientsQuery.count ?? 0;
  const totalDoctors = doctorsQuery.count ?? 0;
  const todaysAppointmentsCount = todaysAppointmentsQuery.count ?? 0;
  const rawAppointments: unknown[] = Array.isArray(upcomingAppointmentsQuery.data)
    ? upcomingAppointmentsQuery.data
    : [];
  const upcomingAppointmentsRaw = rawAppointments.filter(isAppointmentRow);

  const appointmentMapLabel = "[perf] dashboard:transformUpcomingAppointments";
  const appointmentTimer = startTimer(appointmentMapLabel);
  const upcomingAppointments: DashboardAppointment[] = upcomingAppointmentsRaw.map((row) => {
    const patient = pickFirst(row.patients);
    const doctor = pickFirst(row.doctors);
    return {
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      reason: row.reason,
      patient_name: patient?.full_name ?? "Patient",
      patient_mrn: patient?.mrn ?? null,
      doctor_name: doctor?.full_name ?? "Doctor",
    };
  });
  endTimer(appointmentTimer);

  const invoiceTotalsLabel = "[perf] dashboard:aggregateInvoices";
  const invoiceTotalsTimer = startTimer(invoiceTotalsLabel);
  const outstandingBalance = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdueBalance = invoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.balance, 0);
  endTimer(invoiceTotalsTimer);

  const invoicePatientIds = Array.from(new Set(invoices.map((invoice) => invoice.patient_id)));
  let invoicePatientMap = new Map<string, { full_name: string | null }>();
  if (invoicePatientIds.length) {
    const invoicePatientLabel = "[perf] dashboard:fetchInvoicePatients";
    const invoicePatientTimer = startTimer(invoicePatientLabel);
    const { data } = await supabase
      .from("patients")
      .select("id, full_name")
      .in("id", invoicePatientIds);
    endTimer(invoicePatientTimer);
    invoicePatientMap = new Map((data ?? []).map((patient) => [patient.id, patient]));
  }

  const topInvoiceLabel = "[perf] dashboard:prepareTopInvoices";
  const topInvoicesTimer = startTimer(topInvoiceLabel);
  const topInvoices: DashboardInvoice[] = invoices
    .filter((invoice) => invoice.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)
    .map((invoice) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      patient_name: invoicePatientMap.get(invoice.patient_id)?.full_name ?? "Patient",
      balance: invoice.balance,
      due_date: invoice.due_date,
      status: invoice.status,
    }));
  endTimer(topInvoicesTimer);

  const lowStockLabel = "[perf] dashboard:prepareLowStock";
  const lowStockTimer = startTimer(lowStockLabel);
  const lowStockItemsSorted = [...inventoryResult.items].sort((a, b) => a.quantity - b.quantity);
  const lowStockCount = inventoryResult.count;
  const lowStockItems: DashboardInventoryAlert[] = lowStockItemsSorted.slice(0, 5).map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    lowStockThreshold: item.low_stock_threshold ?? undefined,
  }));
  endTimer(lowStockTimer);

  return {
    totalPatients,
    totalDoctors,
    todaysAppointmentsCount,
    outstandingBalance,
    overdueBalance,
    lowStockCount,
    upcomingAppointments,
    topInvoices,
    lowStockItems,
  };
}
