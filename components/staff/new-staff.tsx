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
      <button className="btn-primary text-sm" onClick={() => setOpen(true)}>
        Invite staff
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-[#080a10] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Invite staff member</h2>
                <p className="text-sm text-muted-foreground">
                  Send access to doctors, nurses, and clinic staff.
                </p>
              </div>
              <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>
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
              <label className="text-sm text-muted-foreground block">
                Full name *
                <input
                  name="full_name"
                  required
                  className="field mt-1"
                  placeholder="Dr. Jane Doe"
                />
              </label>

              <label className="text-sm text-muted-foreground block">
                Email *
                <input
                  name="email"
                  type="email"
                  required
                  className="field mt-1"
                  placeholder="jane@example.com"
                />
              </label>

              <label className="text-sm text-muted-foreground block">
                Phone
                <input
                  name="phone"
                  className="field mt-1"
                  placeholder="+1 555 123 4567"
                />
              </label>

              <label className="text-sm text-muted-foreground block">
                Role *
                <select
                  name="role"
                  required
                  className="field mt-1 capitalize"
                >
                  <option value="">Select a role</option>
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? "Saving..." : "Send invite"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
