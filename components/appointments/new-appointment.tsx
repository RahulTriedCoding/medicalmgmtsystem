"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Option = { id: string; label: string };

export default function NewAppointmentButton(props: {
  patients: Option[];
  doctors: Option[];
}) {
  const { patients, doctors } = props;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(form: FormData) {
    setLoading(true);

    const patient_id = String(form.get("patient_id") || "");
    const doctor_id = String(form.get("doctor_id") || "");
    const date = String(form.get("date") || "");
    const start = String(form.get("start") || ""); // HH:MM
    const durationMin = Number(form.get("duration") || 30);
    const reason = String(form.get("reason") || "").trim();

    const patientExists = patients.some((p) => p.id === patient_id);
    const doctorExists = doctors.some((d) => d.id === doctor_id);

    if (!patient_id || !doctor_id || !date || !start || !reason) {
      setLoading(false);
      toast.error("Please fill all required fields.");
      return;
    }

    if (!patientExists) {
      setLoading(false);
      toast.error("Selected patient no longer exists");
      return;
    }

    if (!doctorExists) {
      setLoading(false);
      toast.error("Selected doctor no longer exists");
      return;
    }

    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      setLoading(false);
      toast.error("Duration must be greater than zero");
      return;
    }

    const starts_at = new Date(`${date}T${start}:00`);
    const ends_at = new Date(starts_at.getTime() + durationMin * 60 * 1000);

    if (Number.isNaN(starts_at.getTime()) || Number.isNaN(ends_at.getTime())) {
      setLoading(false);
      toast.error("Invalid date or time");
      return;
    }

    if (ends_at <= starts_at) {
      setLoading(false);
      toast.error("Start time must be before end time");
      return;
    }

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id,
        doctor_id,
        starts_at: starts_at.toISOString(),
        ends_at: ends_at.toISOString(),
        duration: durationMin,
        reason,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to create appointment");
      return;
    }

    toast.success("Appointment created");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setOpen(true)}>
        New appointment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create appointment</h2>
              <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
            >
              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm">Patient *</label>
                <select name="patient_id" required className="rounded-md border px-3 py-2">
                  <option value="">— Select patient —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm">Doctor *</label>
                <select name="doctor_id" required className="rounded-md border px-3 py-2">
                  <option value="">— Select doctor —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Date *</label>
                <input type="date" name="date" required className="rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Start time *</label>
                <input type="time" name="start" required className="rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Duration (min)</label>
                <input type="number" name="duration" defaultValue={30} min={5} step={5} className="rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm">Reason *</label>
                <input name="reason" required maxLength={200} className="rounded-md border px-3 py-2" />
              </div>

              <div className="sm:col-span-2 mt-1">
                <button disabled={loading} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
