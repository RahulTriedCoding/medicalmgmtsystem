import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/store";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: staffRecord } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    role = staffRecord?.role ?? null;
  }

  if (role !== "admin") {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          You need admin permissions to manage clinic settings.
        </p>
      </div>
    );
  }

  const settings = await getSettings(supabase);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update clinic profile, scheduling defaults, and notification preferences.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
