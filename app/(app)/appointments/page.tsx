import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewAppointmentButton from "@/components/appointments/new-appointment";
import RowActions from "@/components/appointments/row-actions";
import { cn } from "@/lib/utils";
import { getClinicDoctors } from "@/lib/staff/store";
import { AppointmentsSearch } from "@/components/appointments/appointments-search";
import { getCurrentStaffContext } from "@/lib/staff/current";
import { AppointmentsDataProvider } from "@/components/appointments/data-context";
import { AppointmentsPagination } from "@/components/appointments/appointments-pagination";
import { startPerf, endPerf } from "@/lib/perf";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const APPOINTMENTS_PAGE_SIZE = 25;
const PATIENT_OPTION_LIMIT = 200;

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
  duration: number | null;
  status: string;
  reason: string | null;
  visit_type: string | null;
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

function visitTypeBadge(visitType?: string | null) {
  switch (visitType) {
    case "follow_up":
      return {
        className: cn(
          "badge text-amber-800 bg-amber-100 border-amber-200",
          "dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50"
        ),
        label: "Follow-up patient",
      };
    default:
      return {
        className: cn(
          "badge text-indigo-800 bg-indigo-100 border-indigo-200",
          "dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-50"
        ),
        label: "New patient",
      };
  }
}

type PageProps = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

async function findPatientIdsBySearch(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  query: string
) {
  const sanitized = query.replace(/[%_\\]/g, (char) => `\\${char}`);
  const likePattern = `%${sanitized}%`;
  const ids = new Set<string>();
  const timer = startPerf(`[perf] appointments:findPatientIds "${query}"`);
  try {
    const fields: Array<"full_name" | "mrn"> = ["full_name", "mrn"];
    for (const field of fields) {
      const { data, error } = await supabase
        .from("patients")
        .select("id")
        .ilike(field, likePattern)
        .limit(PATIENT_OPTION_LIMIT);
      if (error) {
        console.error(`[appointments] patient ${field} search error`, error);
        continue;
      }
      (data ?? []).forEach((row) => ids.add(row.id));
    }
  } finally {
    endPerf(timer);
  }

  return Array.from(ids);
}

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const searchQuery =
    typeof resolvedSearchParams?.search === "string"
      ? resolvedSearchParams.search.trim()
      : "";
  const requestedPage = Number(resolvedSearchParams?.page ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const pageSize = APPOINTMENTS_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const pageTimer = startPerf("[perf] appointments:page");
  const supabase = await createSupabaseServerClient();
  const staffContext = await getCurrentStaffContext(supabase);
  const viewerRole = staffContext.role ?? null;
  const viewerStaffId = staffContext.staffId ?? null;

  // dropdown data
  let doctors: Option[] = [];
  try {
    const doctorTimer = startPerf("[perf] appointments:fetchDoctors");
    const doctorRows = await getClinicDoctors(supabase);
    endPerf(doctorTimer);
    doctors = doctorRows.map((doctor) => ({
      id: doctor.id,
      label: doctor.full_name ?? "Doctor",
    }));
  } catch (doctorError) {
    console.error("[appointments] failed to load doctors", doctorError);
  }

  const patientOptionsTimer = startPerf("[perf] appointments:patientOptions");
  const { data: patientsData } = await supabase
    .from("patients")
    .select("id, full_name, mrn")
    .order("full_name")
    .limit(PATIENT_OPTION_LIMIT);
  endPerf(patientOptionsTimer);
  const patients: Option[] = (patientsData ?? []).map((p) => ({
    id: p.id,
    label: `${p.full_name} (${p.mrn})`,
  }));

  // appointments with nested relations
  const todayIso = new Date(new Date().toDateString()).toISOString();
  let appointmentQuery = supabase
    .from("appointments")
    .select(
      "id, patient_id, doctor_id, starts_at, ends_at, duration, status, reason, visit_type, " +
        "patients:patient_id(full_name, mrn), doctors:doctor_id(full_name)",
      { count: "exact" }
    )
    .gte("starts_at", todayIso)
    .order("starts_at", { ascending: true })
    .range(from, to);

  let filteredPatientIds: string[] | null = null;
  let skipAppointmentsFetch = false;
  if (searchQuery) {
    filteredPatientIds = await findPatientIdsBySearch(supabase, searchQuery);
    if (!filteredPatientIds.length) {
      skipAppointmentsFetch = true;
    }
    if (filteredPatientIds.length) {
      appointmentQuery = appointmentQuery.in("patient_id", filteredPatientIds);
    }
  }

  let totalAppointments = 0;
  let error: { message: string } | null = null;
  let apptsRaw: unknown[] = [];
  if (!skipAppointmentsFetch) {
    const apptTimer = startPerf("[perf] appointments:fetchList");
    const response = await appointmentQuery;
    endPerf(apptTimer);
    apptsRaw = response.data ?? [];
    error = response.error;
    totalAppointments = response.count ?? 0;
  } else {
    apptsRaw = [];
  }

  // 🔧 flatten nested arrays/objects so TS is happy
  const rows: AppointmentRow[] = Array.isArray(apptsRaw)
    ? (apptsRaw as unknown[]).filter((entry): entry is AppointmentRow =>
        isAppointmentRow(entry)
      )
    : [];
  const appts = rows.map((a) => ({
    id: a.id,
    patient_id: a.patient_id,
    doctor_id: a.doctor_id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    duration: typeof a.duration === "number" ? a.duration : null,
    status: a.status,
    reason: a.reason,
    visit_type: a.visit_type ?? "new",
    patient_name: Array.isArray(a.patients) ? a.patients[0]?.full_name : a.patients?.full_name,
    patient_mrn:  Array.isArray(a.patients) ? a.patients[0]?.mrn       : a.patients?.mrn,
    doctor_name:  Array.isArray(a.doctors)  ? a.doctors[0]?.full_name  : a.doctors?.full_name,
  }));

  const showPagination = !error && (totalAppointments > 0 || page > 1);

  const content = (
    <AppointmentsDataProvider patients={patients} doctors={doctors}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Appointments</h1>
            <p className="text-sm text-muted-foreground">
              Monitor today&apos;s schedule and take timely actions.
            </p>
          </div>
          <NewAppointmentButton patients={patients} doctors={doctors} />
        </div>
        <AppointmentsSearch initialValue={searchQuery} />

        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400">Error: {error.message}</div>
        ) : !appts.length ? (
          <div className="text-sm text-muted-foreground">
            {searchQuery ? "No appointments match the search." : "No upcoming appointments."}
          </div>
        ) : (
          <div className="surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Patient</th>
                  <th className="text-left p-2">Visit type</th>
                  <th className="text-left p-2">Doctor</th>
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Reason</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appts.map((a) => {
                  const visitBadge = visitTypeBadge(a.visit_type);
                  return (
                    <tr key={a.id} className="border-t">
                      <td className="p-2">
                        {a.patient_name} ({a.patient_mrn})
                      </td>
                      <td className="p-2">
                        <span className={visitBadge.className}>{visitBadge.label}</span>
                      </td>
                      <td className="p-2">{a.doctor_name ?? "—"}</td>
                      <td className="p-2">
                        {fmt(a.starts_at)} – {fmt(a.ends_at)}
                      </td>
                      <td className="p-2">
                        <span className={appointmentStatusClass(a.status)}>
                          {a.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-2">{a.reason}</td>
                      <td className="p-2">
                        <RowActions
                          id={a.id}
                          status={a.status}
                          appointment={{
                            patientId: a.patient_id,
                            doctorId: a.doctor_id,
                            startsAt: a.starts_at,
                            endsAt: a.ends_at,
                            duration: a.duration,
                            reason: a.reason ?? "",
                            status: a.status,
                          }}
                          viewerRole={viewerRole}
                          viewerStaffId={viewerStaffId}
                          patientName={a.patient_name}
                          patientMrn={a.patient_mrn}
                          doctorName={a.doctor_name}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {showPagination && (
          <AppointmentsPagination page={page} pageSize={pageSize} total={totalAppointments} />
        )}
      </div>
    </AppointmentsDataProvider>
  );

  endPerf(pageTimer);
  return content;
}
