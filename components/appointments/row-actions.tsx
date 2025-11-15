"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
type Props = {
  id: string;
  status?: string | null;
};

export default function RowActions({ id, status }: Props) {
  const router = useRouter();
  const isCancelled = status === "cancelled";

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
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this appointment?")) return;
    const res = await fetch(`/api/appointments/${id}`, { method: "DELETE", cache: "no-store" });
    if (!res.ok) { toast.error((await res.json()).error || "Failed to delete"); return; }
    toast.success("Appointment deleted");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isCancelled ? (
        <span className="badge border-slate-300 bg-slate-100 text-[11px] text-slate-600 dark:border-slate-500/50 dark:bg-slate-600/30 dark:text-slate-200">
          Cancelled
        </span>
      ) : (
        <button onClick={cancel} className="btn-secondary text-xs">
          Cancel
        </button>
      )}
      <button onClick={remove} className="btn-danger text-xs">
        Delete
      </button>
    </div>
  );
}
