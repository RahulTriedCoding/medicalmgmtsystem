import type { SupabaseClient } from "@supabase/supabase-js";
import { readJsonFile } from "@/lib/storage/json";
import type { AppSettings } from "@/lib/settings/store";

const LEGACY_FILE = "settings.json";

export type SettingsMigrationResult = {
  migrated: boolean;
  skipped: boolean;
};

export async function migrateLegacySettings(options: {
  supabase: SupabaseClient;
}): Promise<SettingsMigrationResult> {
  const { supabase } = options;
  const legacy = await readJsonFile<AppSettings>(LEGACY_FILE, {
    clinic_name: "Acme Medical Center",
    clinic_email: "hello@example.com",
    clinic_phone: "+1 (555) 123-4567",
    clinic_address: "123 Main Street, Springfield, USA",
    currency: "USD",
    timezone: "UTC",
    default_appointment_duration: 30,
    enable_email_notifications: true,
    enable_sms_notifications: false,
    billing_notes: "",
  });

  const { data } = await supabase.from("app_settings").select("singleton").maybeSingle();
  if (data) {
    return { migrated: false, skipped: true };
  }

  const { error } = await supabase.from("app_settings").insert({
    singleton: true,
    clinic_name: legacy.clinic_name,
    clinic_email: legacy.clinic_email,
    clinic_phone: legacy.clinic_phone,
    clinic_address: legacy.clinic_address,
    currency: legacy.currency,
    timezone: legacy.timezone,
    default_appointment_duration: legacy.default_appointment_duration,
    enable_email_notifications: legacy.enable_email_notifications,
    enable_sms_notifications: legacy.enable_sms_notifications,
    billing_notes: legacy.billing_notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { migrated: true, skipped: false };
}
