import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";

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

type ServerClient = SupabaseClient;

async function ensureClient(client?: ServerClient) {
  return client ?? (await createSupabaseServerClient());
}

type SettingsRow = {
  clinic_name: string;
  clinic_email: string;
  clinic_phone: string;
  clinic_address: string;
  currency: string;
  timezone: string;
  default_appointment_duration: number;
  enable_email_notifications: boolean;
  enable_sms_notifications: boolean;
  billing_notes: string | null;
};

function mapRowToSettings(row: SettingsRow): AppSettings {
  return {
    clinic_name: row.clinic_name,
    clinic_email: row.clinic_email,
    clinic_phone: row.clinic_phone,
    clinic_address: row.clinic_address,
    currency: row.currency,
    timezone: row.timezone,
    default_appointment_duration: Number(row.default_appointment_duration ?? 30),
    enable_email_notifications: !!row.enable_email_notifications,
    enable_sms_notifications: !!row.enable_sms_notifications,
    billing_notes: row.billing_notes ?? "",
  };
}

async function fetchSettingsRow(supabase: ServerClient): Promise<SettingsRow | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select(
      "clinic_name, clinic_email, clinic_phone, clinic_address, currency, timezone, default_appointment_duration, enable_email_notifications, enable_sms_notifications, billing_notes"
    )
    .eq("singleton", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function insertDefaultSettings(supabase: ServerClient, staffId: string | null): Promise<SettingsRow> {
  const defaults = normalize(defaultSettings);
  const { data, error } = await supabase
    .from("app_settings")
    .insert({
      clinic_name: defaults.clinic_name,
      clinic_email: defaults.clinic_email,
      clinic_phone: defaults.clinic_phone,
      clinic_address: defaults.clinic_address,
      currency: defaults.currency,
      timezone: defaults.timezone,
      default_appointment_duration: defaults.default_appointment_duration,
      enable_email_notifications: defaults.enable_email_notifications,
      enable_sms_notifications: defaults.enable_sms_notifications,
      billing_notes: defaults.billing_notes,
      updated_by: staffId,
    })
    .select(
      "clinic_name, clinic_email, clinic_phone, clinic_address, currency, timezone, default_appointment_duration, enable_email_notifications, enable_sms_notifications, billing_notes"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getSettings(client?: ServerClient): Promise<AppSettings> {
  const supabase = await ensureClient(client);
  let row = await fetchSettingsRow(supabase);
  if (!row) {
    const { staffId } = await getCurrentStaffContext(supabase);
    row = await insertDefaultSettings(supabase, staffId);
  }
  return mapRowToSettings(row);
}

export async function saveSettings(
  payload: Partial<AppSettings>,
  client?: ServerClient
): Promise<AppSettings> {
  const supabase = await ensureClient(client);
  const existing = await getSettings(supabase);
  const next = normalize({ ...existing, ...payload });
  const { staffId } = await getCurrentStaffContext(supabase);

  const { data, error } = await supabase
    .from("app_settings")
    .update({
      clinic_name: next.clinic_name,
      clinic_email: next.clinic_email,
      clinic_phone: next.clinic_phone,
      clinic_address: next.clinic_address,
      currency: next.currency,
      timezone: next.timezone,
      default_appointment_duration: next.default_appointment_duration,
      enable_email_notifications: next.enable_email_notifications,
      enable_sms_notifications: next.enable_sms_notifications,
      billing_notes: next.billing_notes,
      updated_by: staffId,
    })
    .eq("singleton", true)
    .select("clinic_name, clinic_email, clinic_phone, clinic_address, currency, timezone, default_appointment_duration, enable_email_notifications, enable_sms_notifications, billing_notes")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRowToSettings(data);
}
