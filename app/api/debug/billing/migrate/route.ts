import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaffContext, type StaffContext } from "@/lib/staff/current";
import { migrateLegacyBillingData } from "@/lib/billing/migrate";
import { extractAuthUserIdFromToken } from "@/lib/auth/token";

export const runtime = "nodejs";

function getAccessToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
}

async function resolveStaffFromToken(
  accessToken: string,
  adminClient: SupabaseClient
): Promise<StaffContext | null> {
  const authUserId = extractAuthUserIdFromToken(accessToken);
  if (!authUserId) {
    return null;
  }

  const { data, error } = await adminClient
    .from("users")
    .select("id, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return { authUserId, staffId: data.id ?? null, role: data.role ?? null };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Supabase service role key is not configured on the server." },
      { status: 500 }
    );
  }

  const accessToken = getAccessToken(req);
  const staff = accessToken
    ? await resolveStaffFromToken(accessToken, adminClient)
    : await getCurrentStaffContext(supabase);

  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await migrateLegacyBillingData({ supabase: adminClient });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
