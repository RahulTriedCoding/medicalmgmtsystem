export type Patient = {
  id: string;
  mrn: string;
  full_name: string;
  phone?: string | null;
  dob?: string | null;
  gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
  address?: string | null;
  allergies?: string | null;
  blood_group?: string | null;
  marital_status?: string | null;
  location?: string | null;
  state?: string | null;
  country?: string | null;
  district?: string | null;
  relative_name?: string | null;
  relative_phone?: string | null;
  occupation?: string | null;
};

export function isPatientRow(row: unknown): row is Patient {
  if (!row || typeof row !== "object") return false;
  const candidate = row as Partial<Patient>;
  return typeof candidate.id === "string" && candidate.id.length > 0;
}
