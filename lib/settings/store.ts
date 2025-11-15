import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
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

const SETTINGS_COLUMNS =
  "id, clinic_name, clinic_email, clinic_phone, clinic_address, currency, timezone, default_appointment_duration, enable_email_notifications, enable_sms_notifications, billing_notes";

type SettingsRow = {
  id: string;
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

class SettingsSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsSchemaError";
  }
}

function isSchemaError(error: PostgrestError | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  const message = error.message ?? "";
  return /column .*does not exist/i.test(message) || /relation .*does not exist/i.test(message);
}

async function fetchSettingsRow(supabase: ServerClient): Promise<SettingsRow | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select(SETTINGS_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSchemaError(error)) {
      throw new SettingsSchemaError(error.message);
    }
    throw new Error(error.message);
  }

  return data ?? null;
}

async function insertDefaultSettings(supabase: ServerClient, staffId: string | null): Promise<SettingsRow> {
  const defaults = normalize(defaultSettings);
  return insertSettingsRow(
    supabase,
    {
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
    }
  );
}

async function insertSettingsRow(
  supabase: ServerClient,
  payload: Omit<SettingsRow, "id"> & { updated_by?: string | null }
): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("app_settings")
    .insert(payload)
    .select(SETTINGS_COLUMNS)
    .single();

  if (error) {
    if (isSchemaError(error)) {
      throw new SettingsSchemaError(error.message);
    }
    throw new Error(error.message);
  }

  return data;
}

export async function getSettings(client?: ServerClient): Promise<AppSettings> {
  const supabase = await ensureClient(client);
  let row: SettingsRow | null = null;

  try {
    row = await fetchSettingsRow(supabase);
  } catch (error) {
    if (error instanceof SettingsSchemaError) {
      console.error("[settings] schema mismatch:", error.message);
      return defaultSettings;
    }
    throw error;
  }

  if (!row) {
    try {
      const { staffId } = await getCurrentStaffContext(supabase);
      row = await insertDefaultSettings(supabase, staffId);
    } catch (error) {
      if (error instanceof SettingsSchemaError) {
        console.error("[settings] unable to insert default settings due to schema mismatch:", error.message);
        return defaultSettings;
      }
      throw error;
    }
  }

  return mapRowToSettings(row);
}

export async function saveSettings(
  payload: Partial<AppSettings>,
  client?: ServerClient
): Promise<AppSettings> {
  const supabase = await ensureClient(client);
  let currentRow: SettingsRow | null = null;
  try {
    currentRow = await fetchSettingsRow(supabase);
  } catch (error) {
    if (error instanceof SettingsSchemaError) {
      throw new Error("Settings storage is not ready. Apply the latest Supabase migrations and try again.");
    }
    throw error;
  }
  const baseSettings = currentRow ? mapRowToSettings(currentRow) : defaultSettings;
  const next = normalize({ ...baseSettings, ...payload });
  const { staffId } = await getCurrentStaffContext(supabase);

  if (currentRow) {
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
      .eq("id", currentRow.id)
      .select(SETTINGS_COLUMNS)
      .single();

    if (error) {
      if (isSchemaError(error)) {
        throw new Error("Settings storage is not ready. Apply the latest Supabase migrations and try again.");
      }
      throw new Error(error.message);
    }

    return mapRowToSettings(data);
  }

  const inserted = await insertSettingsRow(supabase, {
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
  });
  return mapRowToSettings(inserted);
}
