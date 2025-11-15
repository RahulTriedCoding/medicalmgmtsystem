import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";
import { upsertStaffContact } from "@/lib/staff/store";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const context = await getCurrentStaffContext(supabase);

  if (!context.authUserId) {
    return NextResponse.json({ user: null });
  }

  if (context.staffId) {
    await upsertStaffContact(context.staffId, undefined, false, supabase).catch(() => {});
  }

  return NextResponse.json({
    user: {
      email: context.email,
      role: context.role,
    },
  });
}
