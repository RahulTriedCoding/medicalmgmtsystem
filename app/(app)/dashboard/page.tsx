import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchDashboardData } from "@/lib/dashboard/metrics";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function formatDateTime(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "completed":
    case "paid":
      return "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "cancelled":
    case "overdue":
      return "border border-red-400/30 bg-red-500/10 text-red-200";
    case "in_progress":
    case "partial":
      return "border border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border border-sky-400/30 bg-sky-500/10 text-sky-100";
  }
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <article className="surface border border-white/10 p-5">
      <p className="text-xs uppercase tracking-[0.35em] text-white/50">{title}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
    </article>
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const metrics = await fetchDashboardData(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-white/50">Command center</p>
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Key metrics across scheduling, billing, and inventory.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Patients" value={metrics.patientCount.toLocaleString()} />
        <MetricCard
          title="Today's appointments"
          value={metrics.todaysAppointmentsCount.toLocaleString()}
          subtitle="Scheduled for the current day"
        />
        <MetricCard
          title="Outstanding balance"
          value={formatCurrency(metrics.outstandingBalance)}
          subtitle="All unpaid invoices"
        />
        <MetricCard
          title="Low stock items"
          value={metrics.lowStockCount.toString()}
          subtitle="At or below threshold"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface border border-white/10">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-white">Upcoming appointments</h2>
            <p className="text-xs text-muted-foreground">Next five scheduled</p>
          </header>
          {!metrics.upcomingAppointments.length ? (
            <div className="p-4 text-sm text-muted-foreground">No upcoming appointments.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Patient</th>
                    <th className="p-2 text-left">Doctor</th>
                    <th className="p-2 text-left">When</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.upcomingAppointments.map((appt) => (
                    <tr key={appt.id} className="border-t">
                      <td className="p-2">
                        <div>{appt.patient_name}</div>
                        {appt.patient_mrn && (
                          <div className="text-xs text-muted-foreground">MRN {appt.patient_mrn}</div>
                        )}
                      </td>
                      <td className="p-2">{appt.doctor_name}</td>
                      <td className="p-2">{formatDateTime(appt.starts_at)}</td>
                      <td className="p-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(appt.status)}`}
                        >
                          {appt.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="surface border border-white/10">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-white">Outstanding invoices</h2>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(metrics.outstandingBalance)} outstanding / {formatCurrency(metrics.overdueBalance)} overdue
            </p>
          </header>
          {!metrics.topInvoices.length ? (
            <div className="p-4 text-sm text-muted-foreground">No unpaid invoices 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Invoice</th>
                    <th className="p-2 text-left">Patient</th>
                    <th className="p-2 text-left">Due</th>
                    <th className="p-2 text-left">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{invoice.invoice_number}</div>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-2">{invoice.patient_name}</td>
                      <td className="p-2">{formatDateTime(invoice.due_date)}</td>
                      <td className="p-2 font-semibold">{formatCurrency(invoice.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="surface border border-white/10">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-semibold text-white">Inventory alerts</h2>
          <p className="text-xs text-muted-foreground">Items at or below threshold</p>
        </header>
        {!metrics.lowStockItems.length ? (
          <div className="p-4 text-sm text-muted-foreground">All inventory levels look good.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-left">Quantity</th>
                  <th className="p-2 text-left">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {metrics.lowStockItems.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2 text-red-600 font-semibold">{item.quantity}</td>
                    <td className="p-2">{item.lowStockThreshold ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
