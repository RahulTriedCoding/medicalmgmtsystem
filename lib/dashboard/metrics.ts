import type { SupabaseClient } from "@supabase/supabase-js";
import { getInvoices, BillingStatus } from "@/lib/billing/store";
import { getInventoryItems, InventoryItem } from "@/lib/inventory/store";

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
  patientCount: number;
  todaysAppointmentsCount: number;
  outstandingBalance: number;
  overdueBalance: number;
  lowStockCount: number;
  upcomingAppointments: DashboardAppointment[];
  topInvoices: DashboardInvoice[];
  lowStockItems: DashboardInventoryAlert[];
};

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function lowStock(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => {
    if (typeof item.lowStockThreshold !== "number") return false;
    return item.quantity <= item.lowStockThreshold;
  });
}

export async function fetchDashboardData(supabase: SupabaseClient): Promise<DashboardMetrics> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);
  const now = new Date();

  const [
    patientsQuery,
    todaysAppointmentsQuery,
    upcomingAppointmentsQuery,
    invoices,
    inventoryItems,
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", todayStart.toISOString())
      .lt("starts_at", todayEnd.toISOString()),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, reason, " +
          "patients:patient_id(full_name, mrn), doctors:doctor_id(full_name)"
      )
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
    getInvoices(),
    getInventoryItems(),
  ]);

  const patientCount = patientsQuery.count ?? 0;
  const todaysAppointmentsCount = todaysAppointmentsQuery.count ?? 0;
  const upcomingAppointmentsRaw: AppointmentRow[] = upcomingAppointmentsQuery.data ?? [];

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

  const outstandingBalance = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdueBalance = invoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.balance, 0);

  const invoicePatientIds = Array.from(new Set(invoices.map((invoice) => invoice.patient_id)));
  let invoicePatientMap = new Map<string, { full_name: string | null }>();
  if (invoicePatientIds.length) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name")
      .in("id", invoicePatientIds);
    invoicePatientMap = new Map((data ?? []).map((patient) => [patient.id, patient]));
  }

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

  const lowStockItemsRaw = lowStock(inventoryItems);
  const lowStockItemsSorted = [...lowStockItemsRaw].sort((a, b) => a.quantity - b.quantity);
  const lowStockCount = lowStockItemsRaw.length;
  const lowStockItems: DashboardInventoryAlert[] = lowStockItemsSorted.slice(0, 5).map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    lowStockThreshold: item.lowStockThreshold,
  }));

  return {
    patientCount,
    todaysAppointmentsCount,
    outstandingBalance,
    overdueBalance,
    lowStockCount,
    upcomingAppointments,
    topInvoices,
    lowStockItems,
  };
}
