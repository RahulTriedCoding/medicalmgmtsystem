import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaffContext } from "@/lib/staff/current";
import { migrateLegacyPrescriptions } from "@/lib/prescriptions/migrate";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const staff = await getCurrentStaffContext(supabase);

  if (staff.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Supabase service role key is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const result = await migrateLegacyPrescriptions({ supabase: adminClient });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
