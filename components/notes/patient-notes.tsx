"use client";

import Link from "next/link";

type PatientNotesButtonProps = {
  patientId: string;
  patientName?: string | null;
};

export function PatientNotesButton({ patientId, patientName }: PatientNotesButtonProps) {
  return (
    <Link
      href={`/patients/${patientId}/notes`}
      className="btn-secondary text-xs"
      aria-label={`Open notes for ${patientName ?? "patient"}`}
    >
      Notes
    </Link>
  );
}
