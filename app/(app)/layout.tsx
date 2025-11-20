import AppShell from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/store";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.info("[auth] no session detected in app layout, redirecting to /login");
    redirect("/login");
  }

  console.info("[auth] session detected in app layout", {
    userId: session.user.id,
    email: session.user.email ?? null,
  });
  const settings = await getSettings(supabase);
  return <AppShell clinicName={settings.clinic_name}>{children}</AppShell>;
}
