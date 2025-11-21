"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type RemoveStaffButtonProps = {
  id: string;
  name: string;
  disabled?: boolean;
};

export function RemoveStaffButton({ id, name, disabled }: RemoveStaffButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const isBusy = loading || disabled;

  async function onRemove() {
    if (isBusy) return;
    const confirmed = window.confirm(`Revoke access for ${name}? This immediately disables their login.`);
    if (!confirmed) return;
    setLoading(true);
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Failed to revoke access");
      return;
    }

    toast.success("Access revoked");
    router.refresh();
  }

  return (
    <button
      className="text-xs text-rose-300 underline transition hover:text-rose-200 disabled:opacity-50"
      onClick={onRemove}
      disabled={isBusy}
    >
      Revoke access
    </button>
  );
}
