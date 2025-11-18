"use client";

import { useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppointmentNotesButton } from "@/components/notes/appointment-notes";
import { AppointmentsDataContext } from "@/components/appointments/data-context";
import { startPerf, endPerf } from "@/lib/perf";

type AppointmentForEdit = {
  patientId: string;
  doctorId: string | null;
  startsAt: string;
  endsAt: string;
  duration?: number | null;
  reason?: string | null;
  status: string;
};

type Props = {
  id: string;
  status?: string | null;
  appointment: AppointmentForEdit;
  viewerRole: string | null;
  viewerStaffId: string | null;
  patientName?: string | null;
  patientMrn?: string | null;
  doctorName?: string | null;
};

const isDev = process.env.NODE_ENV !== "production";

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

type FormState = {
  patientId: string;
  doctorId: string;
  date: string;
  start: string;
  duration: number;
  reason: string;
  status: string;
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatDateInput(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function formatTimeInput(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function durationFromRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 30;
  return Math.max(1, Math.round((end - start) / 60000));
}

function buildInitialForm(appointment: AppointmentForEdit): FormState {
  return {
    patientId: appointment.patientId,
    doctorId: appointment.doctorId ?? "",
    date: formatDateInput(appointment.startsAt),
    start: formatTimeInput(appointment.startsAt),
    duration: appointment.duration ?? durationFromRange(appointment.startsAt, appointment.endsAt),
    reason: appointment.reason ?? "",
    status: appointment.status ?? "scheduled",
  };
}

export default function RowActions({
  id,
  status,
  appointment,
  viewerRole,
  viewerStaffId,
  patientName,
  patientMrn,
  doctorName,
}: Props) {
  const context = useContext(AppointmentsDataContext);
  if (!context) {
    throw new Error("RowActions must be rendered within AppointmentsDataProvider");
  }
  const { patients, doctors } = context;
  const router = useRouter();
  const isCancelled = status === "cancelled";
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildInitialForm(appointment));
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isDev) return;
    console.log("[perf] RowActions mounted", { appointmentId: id });
    return () => {
      console.log("[perf] RowActions unmounted", { appointmentId: id });
    };
  }, [id]);

  useEffect(() => {
    if (!isDev) return;
    console.log("[perf] RowActions state", { appointmentId: id, editOpen, saving });
  }, [editOpen, id, saving]);

  const canEdit = useMemo(() => {
    if (!viewerRole) return false;
    if (viewerRole === "admin" || viewerRole === "receptionist") return true;
    if (viewerRole === "doctor") {
      return !!appointment.doctorId && appointment.doctorId === viewerStaffId;
    }
    return false;
  }, [viewerRole, viewerStaffId, appointment.doctorId]);

  const canChangeDoctor = viewerRole !== "doctor";
  const hasDoctors = doctors.length > 0;

  async function cancel() {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
      cache: "no-store",
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Failed to cancel appointment");
      return;
    }
    toast.success("Appointment cancelled");
    startTransition(() => router.refresh());
  }

  async function remove() {
    if (!confirm("Delete this appointment?")) return;
    const res = await fetch(`/api/appointments/${id}`, { method: "DELETE", cache: "no-store" });
    if (!res.ok) {
      toast.error((await res.json()).error || "Failed to delete");
      return;
    }
    toast.success("Appointment deleted");
    startTransition(() => router.refresh());
  }

  async function handleSave() {
    if (!form.patientId || !form.doctorId || !form.date || !form.start) {
      toast.error("All required fields must be filled.");
      return;
    }

    const patientExists = patients.some((p) => p.id === form.patientId);
    const doctorExists = doctors.some((d) => d.id === form.doctorId);

    if (!patientExists) {
      toast.error("Selected patient no longer exists");
      return;
    }

    if (!doctorExists) {
      toast.error("Selected doctor no longer exists");
      return;
    }

    const durationMin = Number(form.duration);
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      toast.error("Duration must be greater than zero");
      return;
    }

    const startsAt = new Date(`${form.date}T${form.start}:00`);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60000);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      toast.error("Invalid date or time");
      return;
    }

    if (endsAt <= startsAt) {
      toast.error("Start time must be before end time");
      return;
    }

    const reason = form.reason.trim();
    if (!reason.length) {
      toast.error("Reason is required");
      return;
    }

    setSaving(true);
    const timer = startPerf(`[perf] appointments:update ${id}`);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          patient_id: form.patientId,
          doctor_id: form.doctorId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration: durationMin,
          reason,
          status: form.status,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload?.error ?? "Failed to update appointment");
        return;
      }

      toast.success("Appointment updated");
      setEditOpen(false);
      startTransition(() => router.refresh());
    } finally {
      endPerf(timer);
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AppointmentNotesButton
          appointmentId={id}
          patientId={appointment.patientId}
          patientName={patientName}
          patientMrn={patientMrn}
          doctorName={doctorName}
          startsAt={appointment.startsAt}
          endsAt={appointment.endsAt}
        />
        {canEdit && (
          <button
            onClick={() => {
              setForm(buildInitialForm(appointment));
              setEditOpen(true);
            }}
            className="btn-secondary"
          >
            Edit
          </button>
        )}
        {isCancelled ? (
          <span className="badge border-slate-300 bg-slate-100 text-[11px] text-slate-600 dark:border-slate-500/50 dark:bg-slate-600/30 dark:text-slate-200">
            Cancelled
          </span>
        ) : (
          <button onClick={cancel} className="btn-secondary">
            Cancel
          </button>
        )}
        <button onClick={remove} className="btn-danger">
          Delete
        </button>
      </div>

      {editOpen && (
        <div className="modal-overlay fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur">
          <div className="modal-card w-full max-w-xl max-h-[90vh] space-y-4 overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit appointment</h2>
              <button className="btn-ghost text-xs" onClick={() => setEditOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Patient *</label>
                <select
                  name="patient_id"
                  required
                  className="field"
                  value={form.patientId}
                  onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
                >
                  <option value="">— Select patient —</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Doctor *</label>
                <select
                  name="doctor_id"
                  required
                  className="field disabled:opacity-60"
                  value={form.doctorId}
                  disabled={!hasDoctors || !canChangeDoctor}
                  onChange={(event) => setForm((prev) => ({ ...prev, doctorId: event.target.value }))}
                >
                  <option value="">{hasDoctors ? "— Select doctor —" : "No doctors available"}</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.label}
                    </option>
                  ))}
                </select>
                {!hasDoctors && (
                  <p className="text-xs text-amber-600 dark:text-amber-200">
                    Invite doctors from the Staff page to assign them here.
                  </p>
                )}
                {!canChangeDoctor && (
                  <p className="text-xs text-muted-foreground">Doctors can only edit their own appointment.</p>
                )}
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Date *</label>
                <input
                  type="date"
                  name="date"
                  className="field"
                  value={form.date}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Start time *</label>
                <input
                  type="time"
                  name="start"
                  className="field"
                  value={form.start}
                  onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))}
                  required
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Duration (min)</label>
                <input
                  type="number"
                  name="duration"
                  min={5}
                  step={5}
                  className="field"
                  value={form.duration}
                  onChange={(event) => setForm((prev) => ({ ...prev, duration: Number(event.target.value) }))}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Status</label>
                <select
                  name="status"
                  className="field"
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Reason *</label>
                <input
                  name="reason"
                  required
                  maxLength={200}
                  className="field"
                  value={form.reason}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                />
              </div>

              <div className="sm:col-span-2 form-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving || !hasDoctors} className="btn-primary disabled:opacity-60">
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
