import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClinicalNote = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string;
  note_text: string;
  template_key: string | null;
  created_at: string;
  updated_at: string;
  doctor_name: string | null;
  appointment_starts_at: string | null;
  appointment_ends_at: string | null;
};

type ServerClient = SupabaseClient;

const NOTE_COLUMNS = `
  id,
  appointment_id,
  patient_id,
  doctor_id,
  note_text,
  template_key,
  created_at,
  updated_at,
  doctor:doctor_id(full_name),
  appointment:appointment_id(starts_at, ends_at)
`;

type NoteRow = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string;
  note_text: string;
  template_key: string | null;
  created_at: string;
  updated_at: string;
  doctor: { full_name: string | null } | { full_name: string | null }[] | null;
  appointment:
    | { starts_at: string | null; ends_at: string | null }
    | { starts_at: string | null; ends_at: string | null }[]
    | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapNote(row: NoteRow): ClinicalNote {
  const doctorRelation = normalizeRelation(row.doctor);
  const appointmentRelation = normalizeRelation(row.appointment);
  return {
    id: row.id,
    appointment_id: row.appointment_id ?? null,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    note_text: row.note_text,
    template_key: row.template_key ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    doctor_name: doctorRelation?.full_name ?? null,
    appointment_starts_at: appointmentRelation?.starts_at ?? null,
    appointment_ends_at: appointmentRelation?.ends_at ?? null,
  };
}

async function ensureClient(client?: ServerClient) {
  return client ?? (await createSupabaseServerClient());
}

function isSchemaMissing(error?: PostgrestError | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /relation .*does not exist/i.test(message)
  );
}

function handlePostgrestError(error: PostgrestError): never {
  if (isSchemaMissing(error)) {
    throw new Error("Clinical notes storage is not configured. Ask an admin to run the latest Supabase migrations.");
  }
  throw new Error(error.message);
}

export type ClinicalNotePayload = {
  appointmentId?: string | null;
  patientId: string;
  doctorId: string;
  noteText: string;
  templateKey?: string | null;
};

export async function createClinicalNote(
  payload: ClinicalNotePayload,
  client?: ServerClient
): Promise<ClinicalNote> {
  const supabase = await ensureClient(client);
  const trimmed = payload.noteText.trim();
  if (!trimmed) {
    throw new Error("Note text is required");
  }

  const { data, error } = await supabase
    .from("clinical_notes")
    .insert({
      appointment_id: payload.appointmentId ?? null,
      patient_id: payload.patientId,
      doctor_id: payload.doctorId,
      note_text: trimmed,
      template_key: payload.templateKey ?? null,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    handlePostgrestError(error);
  }

  return mapNote(data as NoteRow);
}

export async function updateClinicalNote(
  noteId: string,
  payload: { noteText: string; templateKey?: string | null },
  client?: ServerClient
): Promise<ClinicalNote> {
  const supabase = await ensureClient(client);
  const trimmed = payload.noteText.trim();
  if (!trimmed) {
    throw new Error("Note text is required");
  }

  const { data, error } = await supabase
    .from("clinical_notes")
    .update({
      note_text: trimmed,
      template_key: payload.templateKey ?? null,
    })
    .eq("id", noteId)
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    handlePostgrestError(error);
  }

  return mapNote(data as NoteRow);
}

type FetchOptions = {
  doctorId?: string | null;
};

export async function getClinicalNotesForAppointment(
  appointmentId: string,
  client?: ServerClient,
  options?: FetchOptions
): Promise<ClinicalNote[]> {
  const supabase = await ensureClient(client);
  let query = supabase
    .from("clinical_notes")
    .select(NOTE_COLUMNS)
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });

  if (options?.doctorId) {
    query = query.eq("doctor_id", options.doctorId);
  }

  const { data, error } = await query;
  if (error) {
    handlePostgrestError(error);
  }
  return (data ?? []).map(mapNote);
}

export async function getClinicalNotesForPatient(
  patientId: string,
  client?: ServerClient,
  options?: FetchOptions
): Promise<ClinicalNote[]> {
  const supabase = await ensureClient(client);
  let query = supabase
    .from("clinical_notes")
    .select(NOTE_COLUMNS)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (options?.doctorId) {
    query = query.eq("doctor_id", options.doctorId);
  }

  const { data, error } = await query;
  if (error) {
    handlePostgrestError(error);
  }

  return (data ?? []).map(mapNote);
}
