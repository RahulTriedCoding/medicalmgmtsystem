import type { SupabaseClient } from "@supabase/supabase-js";
import { readJsonFile } from "@/lib/storage/json";

const LEGACY_FILE = "staff-directory.json";

type LegacyStaffContact = {
  id?: string;
  phone?: string | null;
  pending?: boolean;
};

export type StaffContactsMigrationResult = {
  totalLegacyContacts: number;
  alreadyInSupabase: number;
  migrated: number;
  skipped: Array<{ id: string; reason: string }>;
};

export type StaffContactsMigrationOptions = {
  supabase: SupabaseClient;
};

export async function migrateLegacyStaffContacts(
  options: StaffContactsMigrationOptions
): Promise<StaffContactsMigrationResult> {
  const { supabase } = options;
  if (!supabase) {
    throw new Error("Supabase client is required to migrate staff contacts.");
  }

  const legacyContacts = await readJsonFile<LegacyStaffContact[]>(LEGACY_FILE, []);
  const validContacts = legacyContacts.filter(
    (contact): contact is Required<Pick<LegacyStaffContact, "id">> &
      LegacyStaffContact => typeof contact.id === "string" && contact.id.length > 0
  );

  const result: StaffContactsMigrationResult = {
    totalLegacyContacts: legacyContacts.length,
    alreadyInSupabase: 0,
    migrated: 0,
    skipped: [],
  };

  if (validContacts.length === 0) {
    return result;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("staff_contacts")
    .select("user_id");

  if (existingError) {
    throw new Error(`Failed to read existing staff contacts: ${existingError.message}`);
  }

  const existingIds = new Set((existingRows ?? []).map((row) => row.user_id));

  for (const contact of validContacts) {
    const userId = contact.id!;

    if (existingIds.has(userId)) {
      result.alreadyInSupabase += 1;
      continue;
    }

    const { error: upsertError } = await supabase.from("staff_contacts").upsert(
      {
        user_id: userId,
        phone: contact.phone ?? null,
        pending: !!contact.pending,
        updated_by: null,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      result.skipped.push({
        id: userId,
        reason: upsertError.message,
      });
      continue;
    }

    existingIds.add(userId);
    result.migrated += 1;
  }

  return result;
}
