import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NoteTemplate = {
  id: string;
  name: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type ServerClient = SupabaseClient;

const TEMPLATE_COLUMNS = `
  id,
  name,
  body,
  is_default,
  created_at,
  updated_at
`;

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
    throw new Error("Note templates storage is not configured. Ask an admin to run the latest Supabase migrations.");
  }
  throw new Error(error.message);
}

export async function getNoteTemplates(client?: ServerClient): Promise<NoteTemplate[]> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("note_templates")
    .select(TEMPLATE_COLUMNS)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    handlePostgrestError(error);
  }

  return (data ?? []) as NoteTemplate[];
}

export async function getDefaultNoteTemplate(
  client?: ServerClient
): Promise<NoteTemplate | null> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("note_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("is_default", true)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    handlePostgrestError(error);
  }

  return (data as NoteTemplate) ?? null;
}
