"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function RemoveStaffButton({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onRemove() {
    const confirmed = window.confirm(`Remove ${name}? They will lose access.`);
    if (!confirmed) return;
    setLoading(true);
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Failed to remove staff");
      return;
    }

    toast.success("Staff removed");
    router.refresh();
  }

  return (
    <button
      className="text-xs text-red-600 underline disabled:opacity-50"
      onClick={onRemove}
      disabled={loading}
    >
      Remove
    </button>
  );
}
