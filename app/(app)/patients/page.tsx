// app/(app)/patients/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewPatientButton from "@/components/patients/new-patient";
import { PatientsSearchPanel } from "@/components/patients/patient-search-panel";
import { searchPatients } from "@/lib/patients/store";
import type { Patient } from "@/lib/patients/types";

export default async function PatientsPage() {
  const supabase = await createSupabaseServerClient();
  let patients: Patient[] = [];
  let error: string | null = null;

  try {
    patients = await searchPatients("", supabase);
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load patients. Try again.";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Patients</h1>
          <p className="text-sm text-muted-foreground">
            Manage the clinic roster, update records, and capture clinical notes.
          </p>
        </div>
        <NewPatientButton />
      </div>

      {error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : (
        <PatientsSearchPanel initialPatients={patients} />
      )}
    </div>
  );
}
