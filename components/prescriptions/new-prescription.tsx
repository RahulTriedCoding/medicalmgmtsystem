"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Option = { id: string; label: string };
type InventoryOption = { id: string; label: string; quantity: number };

type Line = { item_id: string; dosage: string; quantity: number };

export default function NewPrescriptionButton(props: {
  patients: Option[];
  doctors: Option[];
  items: InventoryOption[];
}) {
  const { patients, doctors, items } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ item_id: "", dosage: "", quantity: 1 }]);

  function resetForm() {
    setLines([{ item_id: "", dosage: "", quantity: 1 }]);
  }

  function updateLine(index: number, next: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...next } : line))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { item_id: "", dosage: "", quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function onSubmit(form: FormData) {
    setSaving(true);
    const patient_id = String(form.get("patient_id") || "");
    const doctor_id = String(form.get("doctor_id") || "");
    const notes = String(form.get("notes") || "").trim();

    if (!patient_id || !doctor_id) {
      setSaving(false);
      toast.error("Select both patient and doctor.");
      return;
    }

    const patientExists = patients.some((p) => p.id === patient_id);
    const doctorExists = doctors.some((d) => d.id === doctor_id);
    if (!patientExists || !doctorExists) {
      setSaving(false);
      toast.error("Selected patient or doctor is no longer available.");
      return;
    }

    const sanitizedLines = lines
      .map((line) => ({
        item_id: line.item_id,
        dosage: line.dosage.trim(),
        quantity: Number(line.quantity),
      }))
      .filter(
        (line) =>
          line.item_id && line.dosage && Number.isFinite(line.quantity) && line.quantity > 0
      );

    if (!sanitizedLines.length) {
      setSaving(false);
      toast.error("Add at least one medication line.");
      return;
    }

    const unknownItems = sanitizedLines.some(
      (line) => !items.some((item) => item.id === line.item_id)
    );
    if (unknownItems) {
      setSaving(false);
      toast.error("One or more items are invalid.");
      return;
    }

    const body = {
      patient_id,
      doctor_id,
      notes: notes || undefined,
      lines: sanitizedLines,
    };

    const res = await fetch("/api/prescriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (payload?.error === "insufficient_stock") {
        const detailList = Array.isArray(payload.details) ? payload.details : [];
        const info = detailList
          .map((d: { name?: string; requested?: number; available?: number }) =>
            `${d?.name ?? "Item"} (${d?.available ?? 0}/${d?.requested ?? 0})`
          )
          .join(", ");
        toast.error(`Insufficient stock: ${info}`);
      } else {
        toast.error(payload?.error ?? "Failed to save prescription");
      }
      return;
    }

    toast.success("Prescription created");
    resetForm();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setOpen(true)}>
        New prescription
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create prescription</h2>
              <button
                className="rounded-md border px-2 py-1 text-sm"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Close
              </button>
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit(new FormData(event.currentTarget));
              }}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">Patient *</label>
                <select name="patient_id" className="rounded-md border px-3 py-2" required>
                  <option value="">— Select patient —</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.label}
                    </option>
                  ))}
                </select>

                <label className="text-sm">Doctor *</label>
                <select name="doctor_id" className="rounded-md border px-3 py-2" required>
                  <option value="">— Select doctor —</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Medications</h3>
                  <button type="button" className="text-sm underline" onClick={addLine}>
                    Add line
                  </button>
                </div>

                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-md border p-3 sm:grid-cols-[2fr_2fr_1fr_auto]"
                  >
                    <select
                      value={line.item_id}
                      onChange={(event) => updateLine(index, { item_id: event.target.value })}
                      className="rounded-md border px-2 py-1 text-sm"
                      required
                    >
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label} (avail: {item.quantity})
                        </option>
                      ))}
                    </select>

                    <input
                      value={line.dosage}
                      onChange={(event) => updateLine(index, { dosage: event.target.value })}
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="Dose & frequency"
                      required
                    />

                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                      className="rounded-md border px-2 py-1 text-sm"
                      required
                    />

                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-xs text-red-600 underline"
                      disabled={lines.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-sm">Notes</label>
                <textarea
                  name="notes"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                />
              </div>

              <button
                disabled={saving}
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save prescription"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
