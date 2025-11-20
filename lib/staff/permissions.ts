import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentStaffContext } from "@/lib/staff/current";

export type StaffGuardResult = { response: NextResponse } | { role: string; staffId: string | null };

export async function requireStaffRole(
  client: SupabaseClient,
  allowed: string[]
): Promise<StaffGuardResult> {
  const context = await getCurrentStaffContext(client);

  if (!context.authUserId) {
    console.warn("[auth] unauthorized request - no session", {});
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = context.role ?? null;
  if (!role || !allowed.includes(role)) {
    console.warn("[auth] forbidden access attempt", {
      authUserId: context.authUserId,
      email: context.email ?? null,
      staffId: context.staffId,
      role,
      allowed,
    });
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!context.staffId) {
    console.warn("[auth] staff id missing for authorized user", { authUserId: context.authUserId, role });
  }

  console.info("[auth] staff access granted", {
    authUserId: context.authUserId,
    email: context.email ?? null,
    staffId: context.staffId,
    role,
    allowed,
  });

  return { role, staffId: context.staffId };
}
