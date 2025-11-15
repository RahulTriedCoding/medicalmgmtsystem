"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  balance: number;
};

export function RecordPaymentButton({ invoiceId, invoiceNumber, balance }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(form: FormData) {
    const amount = parseFloat(String(form.get("amount") ?? ""));
    const method = String(form.get("method") ?? "").trim();
    const reference = String(form.get("reference") ?? "").trim();
    const paid_at = String(form.get("paid_at") ?? "");

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const payable = Math.min(amount, balance);
    if (payable <= 0) {
      toast.error("No outstanding balance.");
      return;
    }

    setLoading(true);

    const res = await fetch(`/api/billing/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: payable,
        method: method || null,
        reference: reference || null,
        paid_at: paid_at || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Failed to record payment");
      return;
    }

    toast.success("Payment recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        className="btn-secondary text-xs disabled:opacity-50"
        disabled={balance <= 0}
        onClick={() => setOpen(true)}
      >
        Record payment
      </button>

      {open && (
        <div className="modal-overlay fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur">
          <div className="modal-card w-full max-w-md space-y-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Payment for {invoiceNumber}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Outstanding balance: ${balance.toFixed(2)}
                </p>
              </div>
              <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(new FormData(e.currentTarget));
              }}
            >
              <label className="text-sm text-muted-foreground block">
                Amount *
                <input
                  type="number"
                  name="amount"
                  min={0.01}
                  step="0.01"
                  defaultValue={balance.toFixed(2)}
                  className="field mt-1"
                  required
                />
              </label>

              <label className="text-sm text-muted-foreground block">
                Payment date
                <input type="date" name="paid_at" className="field mt-1" />
              </label>

              <label className="text-sm text-muted-foreground block">
                Method
                <input
                  name="method"
                  placeholder="Cash, card, insurance..."
                  className="field mt-1"
                />
              </label>

              <label className="text-sm text-muted-foreground block">
                Reference
                <input
                  name="reference"
                  placeholder="Receipt, auth code..."
                  className="field mt-1"
                />
              </label>

              <div className="form-actions">
                <button disabled={loading} className="btn-primary disabled:opacity-60">
                  {loading ? "Saving..." : "Save payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
