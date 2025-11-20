import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStaffRole } from "@/lib/staff/types";

export type StaffContext = {
  authUserId: string | null;
  staffId: string | null;
  role: string | null;
  email: string | null;
};

async function linkStaffRecord(
  client: SupabaseClient,
  email: string,
  authUserId: string
) {
  const { data, error } = await client
    .from("users")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  try {
    await client
    .from("users")
    .update({ auth_user_id: authUserId })
    .eq("id", data.id);
    console.info("[auth] linked staff record to auth user", { staffId: data.id, authUserId });
  } catch (linkError) {
    console.warn("[auth] failed linking staff record", { staffId: data.id, authUserId, error: linkError });
  }

  return data;
}

export async function getCurrentStaffContext(
  client: SupabaseClient
): Promise<StaffContext> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    console.info("[auth] no authenticated user for staff context");
    return { authUserId: null, staffId: null, role: null, email: null };
  }

  const staffRecord = await client
    .from("users")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffRecord.error) {
    throw staffRecord.error;
  }

  let record = staffRecord.data ?? null;

  if (!record && user.email) {
    record = await linkStaffRecord(client, user.email, user.id);
  }

  const metadataRole = normalizeStaffRole(
    typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null
  );
  const recordRole = normalizeStaffRole(record?.role ?? null);
  const resolvedRole = recordRole ?? metadataRole;

  if (!record) {
    if (metadataRole) {
      console.warn("[auth] staff record not found, using auth metadata role", {
        authUserId: user.id,
        email: user.email ?? null,
        role: metadataRole,
      });
    } else {
      console.warn("[auth] staff record not found", { authUserId: user.id, email: user.email ?? null });
    }
  }

  console.info("[auth] staff context resolved", {
    authUserId: user.id,
    email: user.email ?? null,
    staffId: record?.id ?? null,
    staffRoleInDb: record?.role ?? null,
    normalizedRecordRole: recordRole,
    metadataRole,
    role: resolvedRole ?? null,
  });

  return {
    authUserId: user.id,
    staffId: record?.id ?? null,
    role: resolvedRole ?? null,
    email: user.email ?? null,
  };
}
