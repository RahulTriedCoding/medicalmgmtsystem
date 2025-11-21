"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { STAFF_ROLES, getRoleLabel } from "@/lib/staff/types";

export function NewStaffButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteSecret, setInviteSecret] = useState<{ email: string; password: string } | null>(null);
  const router = useRouter();

  async function onSubmit(form: FormData) {
    const full_name = String(form.get("full_name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const role = String(form.get("role") || "").trim().toLowerCase();

    if (!full_name || !email || !role) {
      toast.error("Name, email, and role are required.");
      return;
    }

    setLoading(true);
    try {
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

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          payload?.message ??
          payload?.error ??
          (payload?.code === "ALREADY_ACTIVE"
            ? "Staff member with this email is already active"
            : "Failed to invite staff. Check logs for details.");
        toast.error(message);
        console.error("[staff/invite] failed", payload);
        return;
      }

      const successMessage =
        payload?.message ??
        (payload?.reactivated ? "Staff access reactivated and login link sent" : "Invitation sent");
      toast.success(successMessage);
      router.refresh();
      setInviteSecret({
        email: payload?.staff?.email ?? email,
        password: payload?.password ?? "",
      });
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    setOpen(false);
    setInviteSecret(null);
  }

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Password copied");
    } catch {
      toast.error("Failed to copy password");
    }
  }

  return (
    <>
      <button className="btn-primary text-sm" onClick={() => setOpen(true)}>
        Invite staff
      </button>
      {open && (
        <div className="modal-overlay fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur">
          <div className="modal-card w-full max-w-lg space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Invite staff member</h2>
                <p className="text-sm text-muted-foreground">
                  Send access to doctors, nurses, and clinic staff.
                </p>
              </div>
              <button className="btn-ghost text-xs" onClick={closeModal}>
                Close
              </button>
            </div>

            {inviteSecret ? (
              <div className="rounded-2xl border border-amber-200/50 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="font-semibold">Share these credentials securely:</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-amber-600 dark:text-amber-200">Email</p>
                <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-sm text-slate-900 dark:bg-white/10 dark:text-white">
                  {inviteSecret.email}
                </p>
                <p className="mt-3 text-xs uppercase tracking-wide text-amber-600 dark:text-amber-200">Temporary password</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-900 dark:bg-white/10 dark:text-white">
                    {inviteSecret.password}
                  </code>
                  <button
                    type="button"
                    className="btn-secondary whitespace-nowrap text-xs disabled:opacity-60"
                    disabled={!inviteSecret.password}
                    onClick={() => inviteSecret.password && copyPassword(inviteSecret.password)}
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-100">
                  This password is shown only once. Share it with the staff member and ask them to sign in at
                  /login or use the invite link sent via email.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary text-sm" onClick={closeModal}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </>
  );
}
