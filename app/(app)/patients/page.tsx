// app/(app)/patients/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewPatientButton from "@/components/patients/new-patient";
import { PatientsSearchPanel } from "@/components/patients/patient-search-panel";
import { searchPatients, type SearchPatientsResult } from "@/lib/patients/store";
import { startPerf, endPerf } from "@/lib/perf";

export default async function PatientsPage() {
  const supabase = await createSupabaseServerClient();
  let initialResult: SearchPatientsResult = { patients: [], total: 0, page: 1, pageSize: 25 };
  let error: string | null = null;
  const pageTimer = startPerf("[perf] patients:pageLoad");
  try {
    initialResult = await searchPatients("", supabase);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load patients. Try again.";
  }
  endPerf(pageTimer);

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
        <PatientsSearchPanel
          initialPatients={initialResult.patients}
          initialMeta={{
            total: initialResult.total,
            page: initialResult.page,
            pageSize: initialResult.pageSize,
          }}
        />
      )}
    </div>
  );
}
