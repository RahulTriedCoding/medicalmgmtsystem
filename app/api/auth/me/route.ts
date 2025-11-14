import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertStaffContact } from "@/lib/staff/store";

type StaffRow = {
  id: string;
  email: string | null;
  role: string | null;
  auth_user_id?: string | null;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ user: null });

  const { data: meRecord } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  let me: StaffRow | null = meRecord ?? null;

  if (!me && user.email) {
    const { data: byEmailRecord } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", user.email)
      .maybeSingle();
    const byEmail: StaffRow | null = byEmailRecord ?? null;

    if (byEmail) {
      await supabase.from("users").update({ auth_user_id: user.id }).eq("id", byEmail.id);
      await upsertStaffContact(byEmail.id, undefined, false, supabase);
      me = { ...byEmail, auth_user_id: user.id };
    }
  }

  return NextResponse.json({ user: me ? { email: me.email, role: me.role } : { email: user.email, role: null } });
}
