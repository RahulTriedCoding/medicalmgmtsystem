"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Patient = {
  id: string;
  full_name: string;
  phone?: string | null;
  dob?: string | null;
  gender?: "male" | "female" | "other" | null;
  address?: string | null;
  allergies?: string | null;
};

export default function EditPatientButton({ patient }: { patient: Patient }) {
  console.log("EditPatientButton props:", patient);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(f: FormData) {
    setLoading(true);

      // ----- DEBUG: ensure we have an id -----
  if (!patient?.id) {
    setLoading(false);
    toast.error("Missing patient id (frontend)");
    console.error("EDIT PATIENT: missing patient.id:", patient);
    return;
  }
  console.log("EDIT PATIENT: sending PATCH for id:", patient.id);
  // ---------------------------------------

    try {
      const rawDob = (f.get("dob")?.toString() || "").trim();

      // Normalize to YYYY-MM-DD
      let dob: string | undefined;
      if (rawDob) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
          dob = rawDob; // already ISO date
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDob)) {
          const [dd, mm, yyyy] = rawDob.split("/");
          dob = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        }
      }

      const payload = {
        full_name: f.get("full_name")?.toString() || "",
        phone: f.get("phone")?.toString() || "",
        dob,
        gender: (f.get("gender")?.toString() || "") || null,
        address: f.get("address")?.toString() || "",
        allergies: f.get("allergies")?.toString() || "",
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

      toast.success("Patient updated successfully");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Update failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn-secondary text-xs" onClick={() => setOpen(true)}>
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-[#080a10] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit patient</h2>
              <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(new FormData(e.currentTarget));
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
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Address</label>
                <input
                  name="address"
                  defaultValue={patient.address ?? ""}
                  className="field"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Allergies</label>
                <input
                  name="allergies"
                  defaultValue={patient.allergies ?? ""}
                  className="field"
                />
              </div>

              <div className="form-actions">
                <button disabled={loading} className="btn-primary disabled:opacity-60">
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
