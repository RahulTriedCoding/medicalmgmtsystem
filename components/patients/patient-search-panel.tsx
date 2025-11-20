"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Patient } from "@/lib/patients/types";
import EditPatientButton from "@/components/patients/edit-patient";
import { PatientNotesButton } from "@/components/notes/patient-notes";
import {
  PATIENT_CREATED_EVENT,
  PATIENT_UPDATED_EVENT,
  type PatientEventDetail,
} from "@/lib/patients/events";
import { startPerf, endPerf } from "@/lib/perf";

const isDev = process.env.NODE_ENV !== "production";

type Props = {
  initialPatients: Patient[];
  initialMeta: {
    total: number;
    page: number;
    pageSize: number;
  };
};

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleDateString();
}

function matchesQuery(patient: Patient, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    patient.full_name.toLowerCase().includes(trimmed) ||
    patient.mrn.toLowerCase().includes(trimmed) ||
    (patient.phone ?? "").toLowerCase().includes(trimmed)
  );
}

function upsertPatient(list: Patient[], next: Patient) {
  const index = list.findIndex((patient) => patient.id === next.id);
  if (index === -1) {
    return [next, ...list];
  }
  const copy = [...list];
  copy[index] = next;
  return copy;
}

function removePatient(list: Patient[], id: string) {
  return list.filter((patient) => patient.id !== id);
}

export function PatientsSearchPanel({ initialPatients, initialMeta }: Props) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [page, setPage] = useState(initialMeta.page);
  const [pageSize, setPageSize] = useState(initialMeta.pageSize);
  const [total, setTotal] = useState(initialMeta.total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);
  const queryRef = useRef(query);
  const pageRef = useRef(page);
  const pageSizeRef = useRef(pageSize);

  useEffect(() => {
    if (isDev) {
      console.log("[perf] PatientsSearchPanel mounted", {
        initialCount: initialPatients.length,
        total: initialMeta.total,
      });
    }
  }, [initialMeta.total, initialPatients.length]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    setPatients(initialPatients);
    setTotal(initialMeta.total);
    setPage(initialMeta.page);
    setPageSize(initialMeta.pageSize);
  }, [initialPatients, initialMeta.page, initialMeta.pageSize, initialMeta.total]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();

    if (firstRun.current) {
      firstRun.current = false;
      return () => controller.abort();
    }

    const debounce = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (trimmed) params.set("search", trimmed);
      const label = `[perf] patients:panel fetch q="${trimmed || "all"}" page=${page}`;
      const timer = startPerf(label);
      try {
        const response = await fetch(`/api/patients?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload?.error ?? "Failed to search patients.");
          setPatients([]);
          return;
        }
        setPatients(payload.patients ?? []);
        setTotal(typeof payload.total === "number" ? payload.total : 0);
        setError(null);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError("Unable to search patients right now.");
        setPatients([]);
      } finally {
        endPerf(timer);
        setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(debounce);
    };
  }, [query, page, pageSize]);

  useEffect(() => {
    if (!isDev) return;
    console.log("[perf] PatientsSearchPanel state", {
      query,
      page,
      count: patients.length,
    });
  }, [patients.length, page, query]);

  useEffect(() => {
    function handleCreated(event: Event) {
      const detail = (event as CustomEvent<PatientEventDetail>).detail;
      if (!detail?.patient) return;
      const patient = detail.patient;
      setTotal((prev) => prev + 1);
      if (!matchesQuery(patient, queryRef.current)) return;
      if (pageRef.current !== 1) return;
      setPatients((prev) => upsertPatient(prev, patient).slice(0, pageSizeRef.current));
    }

    function handleUpdated(event: Event) {
      const detail = (event as CustomEvent<PatientEventDetail>).detail;
      if (!detail?.patient) return;
      const patient = detail.patient;
      const matches = matchesQuery(patient, queryRef.current);
      setPatients((prev) => {
        if (!matches) {
          return prev.some((item) => item.id === patient.id) ? removePatient(prev, patient.id) : prev;
        }
        return upsertPatient(prev, patient);
      });
    }

    window.addEventListener(PATIENT_CREATED_EVENT, handleCreated as EventListener);
    window.addEventListener(PATIENT_UPDATED_EVENT, handleUpdated as EventListener);

    return () => {
      window.removeEventListener(PATIENT_CREATED_EVENT, handleCreated as EventListener);
      window.removeEventListener(PATIENT_UPDATED_EVENT, handleUpdated as EventListener);
    };
  }, []);

  const hasResults = patients.length > 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 0) / pageSize));
  const showingStart = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingEnd = total > 0 ? Math.min(total, showingStart + patients.length - 1) : 0;
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 dark:border-white/10 dark:bg-white/5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search patients by name, MRN, or phone…"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-white dark:placeholder:text-white/60"
            aria-label="Search patients"
          />
        </label>
        {loading && (
          <span className="text-xs font-medium text-muted-foreground">
            Searching…
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {total > 0 ? `Showing ${showingStart}-${showingEnd} of ${total}` : "No patients to display"}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost px-3 py-1 text-xs"
            disabled={!canGoBack || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <span className="tabular-nums">
            Page {page} / {totalPages}
          </span>
          <button
            className="btn-ghost px-3 py-1 text-xs"
            disabled={!canGoForward || loading}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </button>
        </div>
      </div>
      {error && (
        <div className="text-sm text-rose-500 dark:text-rose-300">
          {error}
        </div>
      )}
      <div className="surface overflow-hidden">
        {!hasResults && !error ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No patients found. Try searching by full name, MRN, or phone number.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left whitespace-nowrap">MRN</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left whitespace-nowrap">Phone</th>
                  <th className="p-2 text-left whitespace-nowrap">DOB</th>
                  <th className="p-2 text-left whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{patient.mrn}</td>
                    <td className="p-2">{patient.full_name}</td>
                    <td className="p-2 whitespace-nowrap">{patient.phone ?? "-"}</td>
                    <td className="p-2 whitespace-nowrap">{fmtDate(patient.dob)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                        <EditPatientButton patient={patient} />
                        <PatientNotesButton
                          patientId={patient.id}
                          patientName={patient.full_name}
                          className="w-full sm:w-auto"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
