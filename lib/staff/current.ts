import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffContext = {
  authUserId: string | null;
  staffId: string | null;
  role: string | null;
};

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
    return { authUserId: null, staffId: null, role: null };
  }

  const { data: staffRecord, error } = await client
    .from("users")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    authUserId: user.id,
    staffId: staffRecord?.id ?? null,
    role: staffRecord?.role ?? null,
  };
}
