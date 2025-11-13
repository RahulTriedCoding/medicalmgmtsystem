"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { STAFF_ROLES, getRoleLabel } from "@/lib/staff/types";

export function NewStaffButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(form: FormData) {
    const full_name = String(form.get("full_name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const role = String(form.get("role") || "").trim();

    if (!full_name || !email || !role) {
      toast.error("Name, email, and role are required.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name,
        email,
        phone: phone || null,
        role,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Failed to invite staff");
      return;
    }

    toast.success("Staff member added");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setOpen(true)}>
        Invite staff
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Invite staff member</h2>
                <p className="text-sm text-muted-foreground">
                  Send access to doctors, nurses, and clinic staff.
                </p>
              </div>
              <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit(new FormData(event.currentTarget));
              }}
            >
              <label className="text-sm block">
                Full name *
                <input
                  name="full_name"
                  required
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Dr. Jane Doe"
                />
              </label>

              <label className="text-sm block">
                Email *
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="jane@example.com"
                />
              </label>

              <label className="text-sm block">
                Phone
                <input
                  name="phone"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="+1 555 123 4567"
                />
              </label>

              <label className="text-sm block">
                Role *
                <select
                  name="role"
                  required
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm capitalize"
                >
                  <option value="">Select a role</option>
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                disabled={loading}
                className="w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Saving..." : "Send invite"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
