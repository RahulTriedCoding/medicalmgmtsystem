import { getSettings } from "@/lib/settings/store";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const settings = await getSettings();
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
