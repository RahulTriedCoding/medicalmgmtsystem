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
        className="rounded-md border px-3 py-2 text-sm"
      >
        New patient
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add patient</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border px-2 py-1 text-sm"
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
                <label className="text-sm">MRN *</label>
                <input name="mrn" required className="w-full rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Full name *</label>
                <input name="full_name" required className="w-full rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Phone</label>
                <input name="phone" className="w-full rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">DOB</label>
                <input type="date" name="dob" className="w-full rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Gender</label>
                <select name="gender" className="w-full rounded-md border px-3 py-2">
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Address</label>
                <input name="address" className="w-full rounded-md border px-3 py-2" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Allergies</label>
                <input name="allergies" className="w-full rounded-md border px-3 py-2" />
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  disabled={loading}
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border px-3 py-2 text-sm"
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
