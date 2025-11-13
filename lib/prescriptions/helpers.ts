import type { PostgrestError } from "@supabase/supabase-js";

export const PRESCRIPTION_COLUMN_VARIANTS = [
  { patientKey: "patient_id", doctorKey: "doctor_id" },
  { patientKey: "patientid", doctorKey: "doctorid" },
  { patientKey: "patient", doctorKey: "doctor" },
];

const PATIENT_NAMES = [
  "patient_id",
  "patientid",
  "patient",
  "patientId",
  "patientID",
];
const DOCTOR_NAMES = ["doctor_id", "doctorid", "doctor", "doctorId", "doctorID"];

export const PATIENT_FIELD_CANDIDATES = PATIENT_NAMES;
export const DOCTOR_FIELD_CANDIDATES = DOCTOR_NAMES;

const RELATION_REGEX = new RegExp(`\\b(${[...PATIENT_NAMES, ...DOCTOR_NAMES].join("|")})\\b`, "i");

export function isMissingRelationColumn(error?: PostgrestError | null) {
  if (!error?.message) return false;
  return RELATION_REGEX.test(error.message);
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string | null | undefined) {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

export function pickRelationValue(
  row: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

export function normalizeRelationRefs(row: Record<string, unknown> | null | undefined) {
  return {
    patientRef: pickRelationValue(row, PATIENT_FIELD_CANDIDATES),
    doctorRef: pickRelationValue(row, DOCTOR_FIELD_CANDIDATES),
  };
}
