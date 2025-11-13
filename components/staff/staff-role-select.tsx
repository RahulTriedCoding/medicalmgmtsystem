"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { STAFF_ROLES, StaffRole, getRoleLabel } from "@/lib/staff/types";

export function StaffRoleSelect({ id, role }: { id: string; role: StaffRole }) {
  const [value, setValue] = useState<StaffRole>(role);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function updateRole(next: StaffRole) {
    if (next === value) return;
    setValue(next);
    setLoading(true);
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Failed to update role");
      setValue(role);
      return;
    }

    toast.success("Role updated");
    router.refresh();
  }

  return (
    <select
      className="rounded-md border px-2 py-1 text-sm capitalize"
      value={value}
      onChange={(event) => updateRole(event.target.value as StaffRole)}
      disabled={loading}
    >
      {STAFF_ROLES.map((option) => (
        <option key={option} value={option}>
          {getRoleLabel(option)}
        </option>
      ))}
    </select>
  );
}
