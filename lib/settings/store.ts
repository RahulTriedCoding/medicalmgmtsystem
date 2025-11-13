import { readJsonFile, writeJsonFile } from "@/lib/storage/json";

const FILE = "settings.json";

export type AppSettings = {
  clinic_name: string;
  clinic_email: string;
  clinic_phone: string;
  clinic_address: string;
  currency: string;
  timezone: string;
  default_appointment_duration: number;
  enable_email_notifications: boolean;
  enable_sms_notifications: boolean;
  billing_notes: string;
};

const defaultSettings: AppSettings = {
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
};

function normalize(payload: Partial<AppSettings>): AppSettings {
  return {
    clinic_name: payload.clinic_name?.trim() || defaultSettings.clinic_name,
    clinic_email: payload.clinic_email?.trim() || defaultSettings.clinic_email,
    clinic_phone: payload.clinic_phone?.trim() || defaultSettings.clinic_phone,
    clinic_address: payload.clinic_address?.trim() || defaultSettings.clinic_address,
    currency: payload.currency?.trim() || defaultSettings.currency,
    timezone: payload.timezone?.trim() || defaultSettings.timezone,
    default_appointment_duration:
      Number.isFinite(payload.default_appointment_duration) && payload.default_appointment_duration
        ? Math.max(5, Math.min(240, Math.round(payload.default_appointment_duration)))
        : defaultSettings.default_appointment_duration,
    enable_email_notifications:
      typeof payload.enable_email_notifications === "boolean"
        ? payload.enable_email_notifications
        : defaultSettings.enable_email_notifications,
    enable_sms_notifications:
      typeof payload.enable_sms_notifications === "boolean"
        ? payload.enable_sms_notifications
        : defaultSettings.enable_sms_notifications,
    billing_notes: payload.billing_notes?.trim() ?? "",
  };
}

export async function getSettings(): Promise<AppSettings> {
  return readJsonFile<AppSettings>(FILE, defaultSettings);
}

export async function saveSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = normalize({ ...current, ...payload });
  await writeJsonFile(FILE, next);
  return next;
}
