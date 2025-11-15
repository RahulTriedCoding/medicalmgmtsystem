import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Patient } from "./types";
import { isPatientRow } from "./types";

type ServerClient = SupabaseClient;

const PATIENT_COLUMNS =
  "id, mrn, full_name, phone, dob, gender, address, allergies";

function escapeIlikeValue(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

async function ensureClient(client?: ServerClient) {
  if (client) return client;
  return createSupabaseServerClient();
}

export async function searchPatients(
  query?: string,
  client?: ServerClient
): Promise<Patient[]> {
  const supabase = await ensureClient(client);
  const term = query?.trim() ?? "";

  let request = supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    .order("full_name", { ascending: true })
    .limit(100);

  if (term) {
    const escaped = escapeIlikeValue(term);
    const pattern = `%${escaped}%`;
    request = request.or(
      `full_name.ilike.${pattern},mrn.ilike.${pattern},phone.ilike.${pattern}`
    );
  }

  const { data, error } = await request;
  if (error) {
    throw normalizePatientError(error);
  }

  return (data ?? []).filter(isPatientRow);
}

function normalizePatientError(error: PostgrestError) {
  if (error.code === "PGRST116") {
    return new Error("Patients data is unavailable. Ensure tables exist.");
  }
  return new Error(error.message);
}
