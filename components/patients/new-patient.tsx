"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from "@/lib/patients/constants";
import type { Patient } from "@/lib/patients/types";
import { collectPatientFormValues } from "@/components/patients/form-values";
import { emitPatientCreated } from "@/lib/patients/events";
import { startPerf, endPerf } from "@/lib/perf";

const isDev = process.env.NODE_ENV !== "production";

export default function NewPatientButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDev) console.log("[perf] NewPatientButton mounted");
  }, []);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const timer = startPerf("[perf] patients:newPatientSubmit");
    const snapshot = collectPatientFormValues(formData);
    const body = {
      mrn: snapshot.mrn,
      full_name: snapshot.full_name,
      phone: snapshot.phone ?? undefined,
      dob: snapshot.dob ?? undefined,
      gender: snapshot.gender ?? undefined,
      address: snapshot.address ?? undefined,
      allergies: snapshot.allergies ?? undefined,
      blood_group: snapshot.blood_group ?? undefined,
      marital_status: snapshot.marital_status ?? undefined,
      location: snapshot.location ?? undefined,
      state: snapshot.state ?? undefined,
      country: snapshot.country ?? undefined,
      district: snapshot.district ?? undefined,
      relative_name: snapshot.relative_name ?? undefined,
      relative_phone: snapshot.relative_phone ?? undefined,
      occupation: snapshot.occupation ?? undefined,
    };

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(payload.error ?? "Failed to add patient");
        return;
      }

      const createdId = payload?.patient?.id;
      if (typeof createdId === "string") {
        const createdPatient: Patient = { id: createdId, ...snapshot };
        emitPatientCreated(createdPatient);
      }

      toast.success("Patient added");
      setOpen(false);
    } finally {
      endPerf(timer);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          if (isDev) console.log("[perf] open new patient modal");
          setOpen(true);
        }}
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
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
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
                <input name="phone" className="field" inputMode="tel" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">DOB</label>
                <input type="date" name="dob" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Gender</label>
                <select name="gender" className="field">
                  <option value="">—</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Blood group</label>
                <select name="blood_group" className="field">
                  <option value="">—</option>
                  {BLOOD_GROUP_OPTIONS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Marital status</label>
                <select name="marital_status" className="field">
                  <option value="">—</option>
                  {MARITAL_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Occupation</label>
                <input name="occupation" className="field" />
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Address</label>
                <textarea name="address" className="field min-h-[90px]" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Location</label>
                <input name="location" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">District</label>
                <input name="district" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">State</label>
                <input name="state" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Country</label>
                <input name="country" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Relative name</label>
                <input name="relative_name" className="field" />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Relative phone</label>
                <input name="relative_phone" className="field" inputMode="tel" />
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Allergies</label>
                <textarea name="allergies" className="field min-h-[80px]" />
              </div>

              <div className="form-actions sm:col-span-2">
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
