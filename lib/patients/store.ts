import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startPerf, endPerf } from "@/lib/perf";
import type { Patient } from "./types";
import { isPatientRow } from "./types";

type ServerClient = SupabaseClient;
const PATIENT_COLUMNS =
  "id, mrn, full_name, phone, dob, gender, address, allergies, blood_group, marital_status, location, state, country, district, relative_name, relative_phone, occupation";
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export type SearchPatientsOptions = {
  page?: number;
  pageSize?: number;
  columns?: string;
};

export type SearchPatientsResult = {
  patients: Patient[];
  total: number;
  page: number;
  pageSize: number;
};

function escapeIlikeValue(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

async function ensureClient(client?: ServerClient) {
  if (client) return client;
  return createSupabaseServerClient();
}

export async function searchPatients(
  query?: string,
  client?: ServerClient,
  options?: SearchPatientsOptions
): Promise<SearchPatientsResult> {
  const supabase = await ensureClient(client);
  const term = query?.trim() ?? "";
  const rawPage = Number(options?.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const rawPageSize = Number(options?.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.max(1, Math.min(Math.floor(rawPageSize), MAX_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const columns = options?.columns ?? PATIENT_COLUMNS;

  let request = supabase
    .from("patients")
    .select(columns, { count: "exact" })
    .order("full_name", { ascending: true })
    .range(from, to);

  if (term) {
    const escaped = escapeIlikeValue(term);
    const pattern = `%${escaped}%`;
    request = request.or(
      `full_name.ilike.${pattern},mrn.ilike.${pattern},phone.ilike.${pattern}`
    );
  }

  const timer = startPerf(`[perf] patients:search q="${term || "all"}" page=${page}`);
  const { data, error, count } = await request;
  endPerf(timer);
  if (error) {
    throw normalizePatientError(error);
  }

  const rows: unknown[] = Array.isArray(data) ? data : [];
  const patients = rows.filter(isPatientRow);

  return {
    patients,
    total: count ?? 0,
    page,
    pageSize,
  };
}

function normalizePatientError(error: PostgrestError) {
  if (error.code === "PGRST116") {
    return new Error("Patients data is unavailable. Ensure tables exist.");
  }
  return new Error(error.message);
}
