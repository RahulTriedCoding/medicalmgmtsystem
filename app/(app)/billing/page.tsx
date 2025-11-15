import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInvoices, BillingInvoice, BillingStatus } from "@/lib/billing/store";
import { NewInvoiceButton } from "@/components/billing/new-invoice";
import { RecordPaymentButton } from "@/components/billing/record-payment";
import { cn } from "@/lib/utils";

type Patient = { id: string; full_name: string | null; mrn: string | null };
type Option = { id: string; label: string };

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusClasses(status: BillingStatus) {
  switch (status) {
    case "paid":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100";
    case "overdue":
      return "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100";
    case "partial":
      return "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100";
    default:
      return "border border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-100";
  }
}

function statusLabel(status: BillingStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function enrichInvoices(invoices: BillingInvoice[], patients: Patient[]) {
  const patientMap = new Map(patients.map((patient) => [patient.id, patient]));
  return invoices.map((invoice) => {
    const patient = patientMap.get(invoice.patient_id);
    return {
      ...invoice,
      patient_name: patient?.full_name ?? "Patient",
      patient_mrn: patient?.mrn ?? null,
    };
  });
}

function buildPatientOptions(patients: Patient[]): Option[] {
  return patients.map((patient) => ({
    id: patient.id,
    label: patient.mrn && patient.full_name
      ? `${patient.full_name} (${patient.mrn})`
      : patient.full_name ?? "Patient",
  }));
}

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: patients = [], error }, invoices] = await Promise.all([
    supabase.from("patients").select("id, full_name, mrn").order("full_name").limit(200),
    getInvoices(supabase),
  ]);

  const patientOptions = buildPatientOptions(patients as Patient[]);
  const rows = enrichInvoices(invoices, patients as Patient[]);

  const totals = rows.reduce(
    (acc, invoice) => {
      acc.billed += invoice.total;
      const collected = invoice.total - invoice.balance;
      acc.collected += collected;
      acc.outstanding += invoice.balance;
      if (invoice.status === "overdue") {
        acc.overdue += invoice.balance;
      }
      return acc;
    },
    { billed: 0, collected: 0, outstanding: 0, overdue: 0 }
  );

  const sortedRows = [...rows].sort((a, b) => {
    const aDue = Date.parse(a.due_date);
    const bDue = Date.parse(b.due_date);
    if (Number.isNaN(aDue) || Number.isNaN(bDue)) return 0;
    return bDue - aDue;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Track invoices, outstanding balances, and payments.
          </p>
        </div>
        <NewInvoiceButton patients={patientOptions} />
      </div>

      {error && <div className="text-sm text-red-600 dark:text-red-400">Error loading patients: {error.message}</div>}

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <article className="surface p-4">
          <p className="text-sm text-muted-foreground">Total billed</p>
          <p className="text-2xl font-semibold">{formatCurrency(totals.billed)}</p>
        </article>
        <article className="surface p-4">
          <p className="text-sm text-muted-foreground">Collected</p>
          <p className="text-2xl font-semibold">{formatCurrency(totals.collected)}</p>
        </article>
        <article className="surface p-4">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-semibold">{formatCurrency(totals.outstanding)}</p>
        </article>
        <article className="surface p-4">
          <p className="text-sm text-muted-foreground">Overdue</p>
          <p className="text-2xl font-semibold">{formatCurrency(totals.overdue)}</p>
        </article>
      </section>

      {!sortedRows.length ? (
        <div className="surface p-6 text-center text-sm text-muted-foreground">
          No invoices yet. Create one to start tracking billing.
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Invoice</th>
                <th className="p-2 text-left">Patient</th>
                <th className="p-2 text-left">Due</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Balance</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((invoice) => (
                <tr key={invoice.id} className="border-t">
                  <td className="p-2 font-medium">{invoice.invoice_number}</td>
                  <td className="p-2">
                    <div>{invoice.patient_name}</div>
                    {invoice.patient_mrn && (
                      <div className="text-xs text-muted-foreground">MRN {invoice.patient_mrn}</div>
                    )}
                  </td>
                  <td className="p-2">{formatDate(invoice.due_date)}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses(invoice.status)}`}>
                      {statusLabel(invoice.status)}
                    </span>
                  </td>
                  <td className="p-2 text-right font-semibold">{formatCurrency(invoice.total)}</td>
                  <td
                    className={cn(
                      "p-2 text-right font-semibold",
                      invoice.status === "overdue" && "text-rose-600 dark:text-rose-200"
                    )}
                  >
                    {formatCurrency(invoice.balance)}
                  </td>
                  <td className="p-2">
                    <RecordPaymentButton
                      invoiceId={invoice.id}
                      invoiceNumber={invoice.invoice_number}
                      balance={invoice.balance}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
