export type Patient = {
  id: string;
  mrn: string;
  full_name: string;
  phone?: string | null;
  dob?: string | null;
  gender?: "male" | "female" | "other" | null;
  address?: string | null;
  allergies?: string | null;
};

export function isPatientRow(row: unknown): row is Patient {
  if (!row || typeof row !== "object") return false;
  const candidate = row as Partial<Patient>;
  return typeof candidate.id === "string" && candidate.id.length > 0;
}
