"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function NewPatientButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const body = {
      mrn: formData.get("mrn")?.toString() || "",
      full_name: formData.get("full_name")?.toString() || "",
      phone: formData.get("phone")?.toString() || undefined,
      dob: formData.get("dob")?.toString() || undefined,
      gender: formData.get("gender")?.toString() || undefined,
      address: formData.get("address")?.toString() || undefined,
      allergies: formData.get("allergies")?.toString() || undefined,
    };

    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to add patient");
      return;
    }

    toast.success("Patient added");
    setOpen(false);
    router.refresh(); // reload server component data
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary text-sm"
      >
        New patient
      </button>

      {open && (
        <div className="modal-overlay fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur">
          <div className="modal-card w-full max-w-lg space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add patient</h2>
              <button
                onClick={() => setOpen(false)}
                className="btn-ghost text-xs"
              >
                Close
              </button>
            </div>

            <form
              className="mt-4 grid grid-cols-1 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(new FormData(e.currentTarget));
              }}
            >
              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">MRN *</label>
                <input name="mrn" required className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Full name *</label>
                <input name="full_name" required className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Phone</label>
                <input name="phone" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">DOB</label>
                <input type="date" name="dob" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Gender</label>
                <select name="gender" className="field">
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Address</label>
                <input name="address" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Allergies</label>
                <input name="allergies" className="field" />
              </div>

              <div className="form-actions">
                <button
                  disabled={loading}
                  className="btn-primary disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
