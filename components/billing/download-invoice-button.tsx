"use client";

import { useState } from "react";
import { toast } from "sonner";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
};

export function DownloadInvoiceButton({ invoiceId, invoiceNumber }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const response = await fetch(`/api/billing/${invoiceId}/pdf`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload?.error ?? "Unable to download invoice.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `invoice-${invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Invoice download started");
    } catch (error) {
      console.error("[billing] download invoice failed", error);
      toast.error("Failed to download invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn-secondary text-xs disabled:opacity-60"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? "Downloading..." : "Download"}
    </button>
  );
}
