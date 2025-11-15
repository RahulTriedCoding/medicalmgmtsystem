import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewAppointmentButton from "@/components/appointments/new-appointment";
import RowActions from "@/components/appointments/row-actions";
import { AppointmentNotesButton } from "@/components/notes/appointment-notes";
import { cn } from "@/lib/utils";
import { getClinicDoctors } from "@/lib/staff/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmt(d: string) {
  const dt = new Date(d);
  return dt.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type Option = { id: string; label: string };
type AppointmentRelation<T> = T | T[] | null;
type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  reason: string | null;
  patients: AppointmentRelation<{ full_name: string | null; mrn: string | null }>;
  doctors: AppointmentRelation<{ full_name: string | null }>;
};

function isAppointmentRow(value: unknown): value is AppointmentRow {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AppointmentRow>;
  return (
    typeof record.id === "string" &&
    typeof record.patient_id === "string" &&
    typeof record.starts_at === "string" &&
    typeof record.ends_at === "string" &&
    typeof record.status === "string"
  );
}

function appointmentStatusClass(status: string) {
  switch (status) {
    case "scheduled":
      return cn(
        "badge text-sky-700 bg-sky-100 border-sky-200",
        "dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-100"
      );
    case "confirmed":
      return cn(
        "badge text-cyan-700 bg-cyan-100 border-cyan-200",
        "dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-cyan-100"
      );
    case "completed":
      return cn(
        "badge text-emerald-700 bg-emerald-100 border-emerald-200",
        "dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100"
      );
    case "cancelled":
      return cn(
        "badge text-slate-600 bg-slate-200 border-slate-300",
        "dark:border-slate-500/40 dark:bg-slate-600/20 dark:text-slate-200"
      );
    case "no_show":
      return cn(
        "badge text-rose-700 bg-rose-100 border-rose-200",
        "dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100"
      );
    default:
      return cn(
        "badge text-amber-700 bg-amber-100 border-amber-200",
        "dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100"
      );
  }
}

export default async function AppointmentsPage() {
  const supabase = await createSupabaseServerClient();

  // dropdown data
  let doctors: Option[] = [];
  try {
    const doctorRows = await getClinicDoctors(supabase);
    doctors = doctorRows.map((doctor) => ({
      id: doctor.id,
      label: doctor.full_name ?? "Doctor",
    }));
  } catch (doctorError) {
    console.error("[appointments] failed to load doctors", doctorError);
  }

  const { data: patientsData } = await supabase
    .from("patients")
    .select("id, full_name, mrn")
    .order("full_name");
  const patients: Option[] = (patientsData ?? []).map(p => ({ id: p.id, label: `${p.full_name} (${p.mrn})` }));

  // appointments with nested relations
  const { data: apptsRaw, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, doctor_id, starts_at, ends_at, status, reason, " +
      "patients:patient_id(full_name, mrn), doctors:doctor_id(full_name)"
    )
    .gte("starts_at", new Date(new Date().toDateString()).toISOString())
    .order("starts_at", { ascending: true })
    .limit(200);

  // 🔧 flatten nested arrays/objects so TS is happy
  const rows = Array.isArray(apptsRaw)
    ? (apptsRaw.filter((entry) => isAppointmentRow(entry)) as AppointmentRow[])
    : [];
  const appts = rows.map((a) => ({
    id: a.id,
    patient_id: a.patient_id,
    doctor_id: a.doctor_id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    reason: a.reason,
    patient_name: Array.isArray(a.patients) ? a.patients[0]?.full_name : a.patients?.full_name,
    patient_mrn:  Array.isArray(a.patients) ? a.patients[0]?.mrn       : a.patients?.mrn,
    doctor_name:  Array.isArray(a.doctors)  ? a.doctors[0]?.full_name  : a.doctors?.full_name,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Appointments</h1>
          <p className="text-sm text-muted-foreground">Monitor today&apos;s schedule and take timely actions.</p>
        </div>
        <NewAppointmentButton patients={patients} doctors={doctors} />
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400">Error: {error.message}</div>
      ) : !appts.length ? (
        <div className="text-sm text-muted-foreground">No upcoming appointments.</div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Patient</th>
                <th className="text-left p-2">Doctor</th>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Clinical notes</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Reason</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appts.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.patient_name} ({a.patient_mrn})</td>
                  <td className="p-2">{a.doctor_name ?? "—"}</td>
                  <td className="p-2">
                    {fmt(a.starts_at)} – {fmt(a.ends_at)}
                  </td>
                  <td className="p-2">
                    <AppointmentNotesButton
                      appointmentId={a.id}
                      patientId={a.patient_id}
                      patientName={a.patient_name}
                      patientMrn={a.patient_mrn}
                      doctorName={a.doctor_name}
                      startsAt={a.starts_at}
                      endsAt={a.ends_at}
                    />
                  </td>
                  <td className="p-2">
                    <span className={appointmentStatusClass(a.status)}>{a.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="p-2">{a.reason}</td>
                  <td className="p-2">
                    <RowActions id={a.id} status={a.status} />
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
