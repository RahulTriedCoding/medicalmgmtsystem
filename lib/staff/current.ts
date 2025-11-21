import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStaffRole, type StaffRole } from "@/lib/staff/types";

type StaffRecordRow = {
  id: string;
  role: string | null;
  is_active: boolean | null;
  deactivated_at: string | null;
  email: string | null;
};

export type StaffContext = {
  authUserId: string | null;
  staffId: string | null;
  role: StaffRole | null;
  email: string | null;
  isActive: boolean;
};

async function fetchStaffRecord(client: SupabaseClient, authUserId: string): Promise<StaffRecordRow | null> {
  const { data, error } = await client
    .from("users")
    .select("id, role, is_active, deactivated_at, email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getCurrentStaffContext(
  client: SupabaseClient
): Promise<StaffContext> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError) {
    const isSessionMissing =
      (authError as unknown as { __isAuthError?: boolean; message?: string }).__isAuthError &&
      /auth session missing/i.test(authError.message ?? "");
    if (isSessionMissing || authError.status === 400) {
      console.info("[auth] no session while resolving staff context");
      return { authUserId: null, staffId: null, role: null, email: null, isActive: false };
    }
    throw authError;
  }

  if (!user) {
    console.info("[auth] no authenticated user for staff context");
    return { authUserId: null, staffId: null, role: null, email: null, isActive: false };
  }

  const record = await fetchStaffRecord(client, user.id);

  if (!record) {
    console.warn("[auth] staff record not mapped to auth user", {
      authUserId: user.id,
      email: user.email ?? null,
    });
    return { authUserId: user.id, staffId: null, role: null, email: user.email ?? null, isActive: false };
  }

  const recordRole = normalizeStaffRole(record.role ?? null);
  if (!recordRole) {
    console.warn("[auth] staff role missing or invalid", {
      authUserId: user.id,
      email: user.email ?? null,
      staffId: record.id,
      role: record.role ?? null,
    });
  }

  const active = record.is_active === true && !record.deactivated_at;
  if (!active) {
    console.warn("[auth] inactive staff attempted access", {
      authUserId: user.id,
      email: user.email ?? null,
      staffId: record.id,
      deactivated_at: record.deactivated_at,
    });
  }

  console.info("[auth] staff context resolved", {
    authUserId: user.id,
    email: user.email ?? null,
    staffId: record.id,
    staffRoleInDb: record.role ?? null,
    normalizedRecordRole: recordRole,
    isActive: active,
    deactivated_at: record.deactivated_at ?? null,
  });

  return {
    authUserId: user.id,
    staffId: record.id,
    role: recordRole ?? null,
    email: record.email ?? user.email ?? null,
    isActive: active,
  };
}
