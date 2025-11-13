import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";

export type StaffContact = {
  id: string;
  phone: string | null;
  pending: boolean;
};

type ServerClient = SupabaseClient;

// TODO: copy any existing staff-directory.json entries into staff_contacts before enabling this in prod.

async function ensureClient(client?: ServerClient) {
  return client ?? (await createSupabaseServerClient());
}

export async function getStaffContacts(
  client?: ServerClient
): Promise<StaffContact[]> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("staff_contacts")
    .select("user_id, phone, pending")
    .order("user_id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.user_id,
    phone: row.phone ?? null,
    pending: !!row.pending,
  }));
}

function normalizePhone(phone?: string | null) {
  if (phone === undefined) return undefined;
  if (!phone) return null;
  const trimmed = phone.trim();
  return trimmed.length ? trimmed : null;
}

export async function upsertStaffContact(
  id: string,
  phone?: string | null,
  pending?: boolean,
  client?: ServerClient
) {
  const supabase = await ensureClient(client);
  const { staffId } = await getCurrentStaffContext(supabase);
  const normalizedPhone = normalizePhone(phone);

  let nextPhone = normalizedPhone;
  let nextPending = pending;

  if (nextPhone === undefined || nextPending === undefined) {
    const { data: existing, error } = await supabase
      .from("staff_contacts")
      .select("phone, pending")
      .eq("user_id", id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    if (nextPhone === undefined) {
      nextPhone = existing?.phone ?? null;
    }
    if (nextPending === undefined) {
      nextPending = existing?.pending ?? false;
    }
  }

  const { error: upsertError } = await supabase.from("staff_contacts").upsert(
    {
      user_id: id,
      phone: nextPhone ?? null,
      pending: nextPending ?? false,
      updated_by: staffId,
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export async function deleteStaffContact(
  id: string,
  client?: ServerClient
) {
  const supabase = await ensureClient(client);
  const { error } = await supabase.from("staff_contacts").delete().eq("user_id", id);
  if (error) {
    throw new Error(error.message);
  }
}
