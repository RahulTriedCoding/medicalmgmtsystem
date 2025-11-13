import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertStaffContact } from "@/lib/staff/store";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ user: null });

  let { data: me } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me && user.email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", user.email)
      .maybeSingle();

    if (byEmail) {
      await supabase.from("users").update({ auth_user_id: user.id }).eq("id", byEmail.id);
      await upsertStaffContact(byEmail.id, undefined, false);
      me = { ...byEmail, auth_user_id: user.id };
    }
  }

  return NextResponse.json({ user: me ? { email: me.email, role: me.role } : { email: user.email, role: null } });
}
