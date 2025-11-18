"use client";

import type { Patient } from "@/lib/patients/types";

type PatientFormSnapshot = Omit<Patient, "id">;

function readText(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string") return "";
  return value.trim();
}

function readOptional(form: FormData, key: string, fallback: string | null) {
  const value = form.get(key);
  if (typeof value !== "string") return fallback ?? null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function collectPatientFormValues(form: FormData, defaults?: Patient): PatientFormSnapshot {
  return {
    mrn: readText(form, "mrn") || defaults?.mrn || "",
    full_name: readText(form, "full_name") || defaults?.full_name || "",
    phone: readOptional(form, "phone", defaults?.phone ?? null),
    dob: readOptional(form, "dob", defaults?.dob ?? null),
    gender: (readOptional(form, "gender", defaults?.gender ?? null) ??
      null) as Patient["gender"],
    address: readOptional(form, "address", defaults?.address ?? null),
    allergies: readOptional(form, "allergies", defaults?.allergies ?? null),
    blood_group: readOptional(form, "blood_group", defaults?.blood_group ?? null),
    marital_status: readOptional(
      form,
      "marital_status",
      defaults?.marital_status ?? null
    ),
    location: readOptional(form, "location", defaults?.location ?? null),
    state: readOptional(form, "state", defaults?.state ?? null),
    country: readOptional(form, "country", defaults?.country ?? null),
    district: readOptional(form, "district", defaults?.district ?? null),
    relative_name: readOptional(form, "relative_name", defaults?.relative_name ?? null),
    relative_phone: readOptional(
      form,
      "relative_phone",
      defaults?.relative_phone ?? null
    ),
    occupation: readOptional(form, "occupation", defaults?.occupation ?? null),
  };
}
