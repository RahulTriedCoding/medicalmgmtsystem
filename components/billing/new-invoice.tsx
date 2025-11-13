"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Option = { id: string; label: string };

type LineDraft = {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
};

function createLine(): LineDraft {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    id,
    description: "",
    quantity: "1",
    unit_price: "0",
  };
}

export function NewInvoiceButton({ patients }: { patients: Option[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([createLine()]);
  const router = useRouter();

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unit_price) || 0;
      return sum + Math.max(0, qty) * Math.max(0, price);
    }, 0);
  }, [lines]);

  function resetForm() {
    setLines([createLine()]);
  }

  function updateLine(id: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, createLine()]);
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.id !== id)));
  }

  async function onSubmit(form: FormData) {
    const patient_id = String(form.get("patient_id") || "");
    const due_date = String(form.get("due_date") || "");
    const notes = String(form.get("notes") || "").trim();

    if (!patient_id) {
      toast.error("Select a patient.");
      return;
    }

    if (!due_date || Number.isNaN(Date.parse(due_date))) {
      toast.error("Provide a valid due date.");
      return;
    }

    const preparedLines = lines
      .map((line) => ({
        description: line.description.trim(),
        quantity: parseFloat(line.quantity),
        unit_price: parseFloat(line.unit_price),
      }))
      .filter(
        (line) =>
          line.description.length &&
          Number.isFinite(line.quantity) &&
          line.quantity > 0 &&
          Number.isFinite(line.unit_price) &&
          line.unit_price >= 0
      );

    if (!preparedLines.length) {
      toast.error("Add at least one billable line.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id,
        due_date,
        notes: notes || null,
        line_items: preparedLines,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Failed to create invoice");
      return;
    }

    toast.success("Invoice created");
    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <>
      <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setOpen(true)}>
        New invoice
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">New invoice</h2>
                <p className="text-sm text-muted-foreground">Capture billable services for a patient.</p>
              </div>
              <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(new FormData(e.currentTarget));
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Patient *
                  <select
                    name="patient_id"
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">— Select patient —</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  Due date *
                  <input type="date" name="due_date" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
                </label>
              </div>

              <label className="text-sm block">
                Notes
                <textarea name="notes" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} />
              </label>

              <section className="rounded-lg border">
                <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
                  Line items
                  <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={addLine}>
                    Add line
                  </button>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-left">Quantity</th>
                        <th className="p-2 text-left">Unit price</th>
                        <th className="p-2 text-left">Subtotal</th>
                        <th className="p-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const qty = parseFloat(line.quantity) || 0;
                        const price = parseFloat(line.unit_price) || 0;
                        const subtotal = Math.max(0, qty) * Math.max(0, price);
                        return (
                          <tr key={line.id} className="border-t">
                            <td className="p-2">
                              <input
                                className="w-full rounded-md border px-2 py-1 text-sm"
                                value={line.description}
                                onChange={(e) => updateLine(line.id, { description: e.target.value })}
                                placeholder="Service description"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={0}
                                step="0.25"
                                className="w-full rounded-md border px-2 py-1 text-sm"
                                value={line.quantity}
                                onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-full rounded-md border px-2 py-1 text-sm"
                                value={line.unit_price}
                                onChange={(e) => updateLine(line.id, { unit_price: e.target.value })}
                              />
                            </td>
                            <td className="p-2">{subtotal.toFixed(2)}</td>
                            <td className="p-2">
                              <button
                                type="button"
                                className="rounded-md border px-2 py-1 text-xs"
                                onClick={() => removeLine(line.id)}
                                disabled={lines.length === 1}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <footer className="flex items-center justify-end gap-3 border-t px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-base font-semibold">${total.toFixed(2)}</span>
                </footer>
              </section>

              <div className="flex items-center gap-3">
                <button
                  disabled={loading}
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Create invoice"}
                </button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline"
                  onClick={resetForm}
                >
                  Reset form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
