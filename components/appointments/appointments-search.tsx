"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type AppointmentsSearchProps = {
  initialValue?: string;
};

const isDev = process.env.NODE_ENV !== "production";

export function AppointmentsSearch({ initialValue = "" }: AppointmentsSearchProps) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    if (isDev) console.log("[perf] AppointmentsSearch mounted");
  }, []);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isDev) console.log("[perf] AppointmentsSearch value", value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParamsString);
      const trimmed = value.trim();
      if (trimmed) {
        params.set("search", trimmed);
      } else {
        params.delete("search");
      }
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 300);
    return () => clearTimeout(handler);
  }, [value, pathname, router, searchParamsString]);

  return (
    <div className="w-full max-w-md">
      <label className="sr-only" htmlFor="appointment-search">
        Search appointments
      </label>
      <input
        id="appointment-search"
        type="search"
        className={cn(
          "w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-900 shadow-sm",
          "placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          "dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/70"
        )}
        placeholder="Search by patient name or MRN..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}
