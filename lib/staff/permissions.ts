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

  if (!context.staffId) {
    console.warn("[auth] unauthorized request - staff record missing", {
      authUserId: context.authUserId,
      email: context.email ?? null,
    });
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!context.isActive) {
    console.warn("[auth] inactive staff attempted access", {
      authUserId: context.authUserId,
      email: context.email ?? null,
      staffId: context.staffId,
    });
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const role = context.role ?? null;
  if (!role || !allowed.includes(role)) {
    console.warn("[auth] forbidden access attempt", {
      authUserId: context.authUserId,
      email: context.email ?? null,
      staffId: context.staffId ?? null,
      role,
      allowed,
    });
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
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
