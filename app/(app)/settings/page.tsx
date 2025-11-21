import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/store";
import { SettingsForm } from "@/components/settings/settings-form";
import { getCurrentStaffContext } from "@/lib/staff/current";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const staffContext = await getCurrentStaffContext(supabase);

  if (staffContext.role !== "admin" || !staffContext.isActive) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          You need admin permissions to manage clinic settings.
        </p>
      </div>
    );
  }

  const settings = await getSettings(supabase);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update clinic profile, scheduling defaults, and notification preferences.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
