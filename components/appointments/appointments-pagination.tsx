"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
};

export function AppointmentsPagination({ page, pageSize, total, disabled = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 0) / safeSize));
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;
  const showing = useMemo(() => {
    if (total <= 0) return "No appointments to display";
    const start = (page - 1) * safeSize + 1;
    const end = Math.min(total, start + safeSize - 1);
    return `Showing ${start}-${end} of ${total}`;
  }, [page, safeSize, total]);

  function update(nextPage: number) {
    if (disabled) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200/70 bg-white/70 p-3 text-xs text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
      <span>{showing}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-ghost px-3 py-1 text-xs"
          onClick={() => update(page - 1)}
          disabled={!canGoBack || disabled}
        >
          Previous
        </button>
        <span className="tabular-nums">
          Page {Math.min(page, totalPages)} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-ghost px-3 py-1 text-xs"
          onClick={() => update(page + 1)}
          disabled={!canGoForward || disabled}
        >
          Next
        </button>
      </div>
    </div>
  );
}
