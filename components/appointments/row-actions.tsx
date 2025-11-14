"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppointmentNotesButton } from "@/components/notes/appointment-notes";

type Props = {
  id: string;
  patientName?: string | null;
  doctorName?: string | null;
};

export default function RowActions({ id, patientName, doctorName }: Props) {
  const router = useRouter();

  async function cancel() {
    const res = await fetch(`/api/appointments/${id}`, { method: "PATCH" });
    if (!res.ok) { toast.error((await res.json()).error || "Failed to cancel"); return; }
    toast.success("Appointment cancelled");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this appointment?")) return;
    const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).error || "Failed to delete"); return; }
    toast.success("Appointment deleted");
    router.refresh();
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <AppointmentNotesButton appointmentId={id} patientName={patientName} doctorName={doctorName} />
      <button onClick={cancel} className="btn-secondary text-xs px-3 py-1.5">
        Cancel
      </button>
      <button onClick={remove} className="btn-danger text-xs px-3 py-1.5">
        Delete
      </button>
    </div>
  );
}
