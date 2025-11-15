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
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = context.role ?? null;
  if (!role || !allowed.includes(role)) {
    console.warn("[auth] forbidden access attempt", { authUserId: context.authUserId, role });
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!context.staffId) {
    console.warn("[auth] staff id missing for authorized user", { authUserId: context.authUserId, role });
  }

  return { role, staffId: context.staffId };
}
