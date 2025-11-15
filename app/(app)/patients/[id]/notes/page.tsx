import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";
import {
  getClinicalNotesForPatient,
  type ClinicalNote,
} from "@/lib/clinical-notes/store";
import type { Patient } from "@/lib/patients/types";
import { PatientNotesSection } from "@/components/patients/patient-notes-section";

type PageProps = {
  params: Promise<{ id?: string }>;
};

export default async function PatientNotesPage({ params }: PageProps) {
  const resolved = await params;
  const patientId = resolved?.id ?? "";
  if (!patientId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, mrn, full_name, phone, dob, gender, address, allergies")
    .eq("id", patientId)
    .maybeSingle();

  if (patientError) {
    console.error("[patients] load patient error", patientError);
  }

  if (!patient) {
    notFound();
  }

  const staffContext = await getCurrentStaffContext(supabase);
  const role = staffContext.role ?? null;
  const canEdit = role === "admin" || role === "doctor";

  let notes: ClinicalNote[] = [];
  try {
    notes = await getClinicalNotesForPatient(
      patientId,
      supabase,
      role === "doctor"
        ? { doctorId: staffContext.staffId ?? undefined }
        : undefined
    );
  } catch (error) {
    console.error("[notes] fetch patient notes error", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/patients"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to patients
        </Link>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Patient notes
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {patient.full_name}
          </h1>
        </div>
      </div>

      <PatientNotesSection
        patient={patient as Patient}
        initialNotes={notes}
        canEdit={canEdit}
      />
    </div>
  );
}
