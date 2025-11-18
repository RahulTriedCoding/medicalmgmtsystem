"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Patient } from "@/lib/patients/types";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from "@/lib/patients/constants";
import { collectPatientFormValues } from "@/components/patients/form-values";
import { emitPatientUpdated } from "@/lib/patients/events";
import { startPerf, endPerf } from "@/lib/perf";

type Props = {
  patient: Patient;
};

const isDev = process.env.NODE_ENV !== "production";

export default function EditPatientButton({ patient }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDev) console.log("[perf] EditPatientButton mounted", { patientId: patient.id });
  }, [patient.id]);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const timer = startPerf(`[perf] patients:editSubmit ${patient.id}`);

    if (!patient?.id) {
      setLoading(false);
      toast.error("Missing patient id");
      return;
    }

    try {
      const rawDob = (formData.get("dob")?.toString() || "").trim();

      let dob: string | null = null;
      if (rawDob) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
          dob = rawDob;
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDob)) {
          const [dd, mm, yyyy] = rawDob.split("/");
          dob = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        }
      }

      const snapshot = collectPatientFormValues(formData, patient);
      const payload = {
        full_name: snapshot.full_name,
        phone: snapshot.phone,
        dob,
        gender: snapshot.gender,
        address: snapshot.address,
        allergies: snapshot.allergies,
        blood_group: snapshot.blood_group,
        marital_status: snapshot.marital_status,
        location: snapshot.location,
        state: snapshot.state,
        country: snapshot.country,
        district: snapshot.district,
        relative_name: snapshot.relative_name,
        relative_phone: snapshot.relative_phone,
        occupation: snapshot.occupation,
      };

      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      const updatedPatient: Patient = { id: patient.id, ...snapshot };
      emitPatientUpdated(updatedPatient);
      toast.success("Patient updated successfully");
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update failed";
      toast.error(message);
    } finally {
      endPerf(timer);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="btn-secondary text-xs"
        onClick={() => {
          if (isDev) console.log("[perf] open edit patient modal", { patientId: patient.id });
          setOpen(true);
        }}
      >
        Edit
      </button>

      {open && (
        <div className="modal-overlay fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur">
          <div className="modal-card w-full max-w-3xl max-h-[90vh] space-y-4 overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit patient</h2>
              <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit(new FormData(event.currentTarget));
              }}
            >
              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Full name *</label>
                <input
                  name="full_name"
                  defaultValue={patient.full_name}
                  required
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Phone</label>
                <input
                  name="phone"
                  defaultValue={patient.phone ?? ""}
                  className="field"
                  inputMode="tel"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">DOB</label>
                <input
                  type="date"
                  name="dob"
                  defaultValue={patient.dob ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Gender</label>
                <select
                  name="gender"
                  defaultValue={patient.gender ?? ""}
                  className="field"
                >
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
                <select
                  name="blood_group"
                  defaultValue={patient.blood_group ?? ""}
                  className="field"
                >
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
                <select
                  name="marital_status"
                  defaultValue={patient.marital_status ?? ""}
                  className="field"
                >
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
                <input
                  name="occupation"
                  defaultValue={patient.occupation ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Address</label>
                <textarea
                  name="address"
                  defaultValue={patient.address ?? ""}
                  className="field min-h-[90px]"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Location</label>
                <input
                  name="location"
                  defaultValue={patient.location ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">District</label>
                <input
                  name="district"
                  defaultValue={patient.district ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">State</label>
                <input
                  name="state"
                  defaultValue={patient.state ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Country</label>
                <input
                  name="country"
                  defaultValue={patient.country ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Relative name</label>
                <input
                  name="relative_name"
                  defaultValue={patient.relative_name ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Relative phone</label>
                <input
                  name="relative_phone"
                  defaultValue={patient.relative_phone ?? ""}
                  className="field"
                  inputMode="tel"
                />
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Allergies</label>
                <textarea
                  name="allergies"
                  defaultValue={patient.allergies ?? ""}
                  className="field min-h-[80px]"
                />
              </div>

              <div className="form-actions sm:col-span-2">
                <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setOpen(false)}
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
