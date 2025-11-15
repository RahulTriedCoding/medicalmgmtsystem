import type { SupabaseClient } from "@supabase/supabase-js";

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

  await client
    .from("users")
    .update({ auth_user_id: authUserId })
    .eq("id", data.id)
    .then(() => {
      console.info("[auth] linked staff record to auth user", { staffId: data.id, authUserId });
    })
    .catch((linkError) => {
      console.warn("[auth] failed linking staff record", { staffId: data.id, authUserId, error: linkError });
    });

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
    return { authUserId: null, staffId: null, role: null, email: null };
  }

  let staffRecord = await client
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

  const metadataRole =
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : null;

  if (!record) {
    if (metadataRole) {
      console.warn("[auth] falling back to auth metadata role", { authUserId: user.id, role: metadataRole });
    } else {
      console.warn("[auth] staff record not found", { authUserId: user.id, email: user.email ?? null });
    }
  }

  return {
    authUserId: user.id,
    staffId: record?.id ?? null,
    role: record?.role ?? metadataRole,
    email: user.email ?? null,
  };
}
