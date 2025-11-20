"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type PatientNotesButtonProps = {
  patientId: string;
  patientName?: string | null;
  className?: string;
};

export function PatientNotesButton({ patientId, patientName, className }: PatientNotesButtonProps) {
  return (
    <Link
      href={`/patients/${patientId}/notes`}
      className={cn("btn-secondary text-xs", className)}
      aria-label={`Open notes for ${patientName ?? "patient"}`}
    >
      Notes
    </Link>
  );
}
