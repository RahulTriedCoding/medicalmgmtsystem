import AppShell from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/store";
import { redirect } from "next/navigation";
import { getCurrentStaffContext } from "@/lib/staff/current";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const staffContext = await getCurrentStaffContext(supabase);

  if (!staffContext.authUserId || !staffContext.staffId || !staffContext.role || !staffContext.isActive) {
    console.info("[auth] unauthorized access attempt in app layout", {
      authUserId: staffContext.authUserId,
      staffId: staffContext.staffId,
      role: staffContext.role,
      isActive: staffContext.isActive,
    });
    redirect("/login");
  }

  console.info("[auth] session verified in app layout", {
    userId: staffContext.authUserId,
    email: staffContext.email ?? null,
    staffId: staffContext.staffId,
    role: staffContext.role,
  });
  const settings = await getSettings(supabase);
  return <AppShell clinicName={settings.clinic_name}>{children}</AppShell>;
}
