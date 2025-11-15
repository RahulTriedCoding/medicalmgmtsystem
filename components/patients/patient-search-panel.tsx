"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Patient } from "@/lib/patients/types";
import EditPatientButton from "@/components/patients/edit-patient";
import { PatientNotesButton } from "@/components/notes/patient-notes";

type Props = {
  initialPatients: Patient[];
};

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleDateString();
}

export function PatientsSearchPanel({ initialPatients }: Props) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();

    if (firstRun.current && !trimmed) {
      firstRun.current = false;
      setPatients(initialPatients);
      return () => controller.abort();
    }
    firstRun.current = false;

    const debounce = setTimeout(async () => {
      setLoading(true);
      if (!trimmed) {
        // optimistic reset while fetching the default view
        setPatients(initialPatients);
      }
      try {
        const params = new URLSearchParams();
        if (trimmed) params.set("search", trimmed);
        const qs = params.toString();
        const response = await fetch(
          qs ? `/api/patients?${qs}` : "/api/patients",
          { signal: controller.signal }
        );
        const payload = await response.json();
        if (!response.ok) {
          setError(payload?.error ?? "Failed to search patients.");
          setPatients([]);
          return;
        }
        setPatients(payload.patients ?? []);
        setError(null);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError("Unable to search patients right now.");
        setPatients([]);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      controller.abort();
      clearTimeout(debounce);
    };
  }, [query, initialPatients]);

  const hasResults = patients.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 dark:border-white/10 dark:bg-white/5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">MRN</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Phone</th>
                <th className="p-2 text-left">DOB</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-t">
                  <td className="p-2">{patient.mrn}</td>
                  <td className="p-2">{patient.full_name}</td>
                  <td className="p-2">{patient.phone ?? "-"}</td>
                  <td className="p-2">{fmtDate(patient.dob)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <EditPatientButton patient={patient} />
                      <PatientNotesButton
                        patientId={patient.id}
                        patientName={patient.full_name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
