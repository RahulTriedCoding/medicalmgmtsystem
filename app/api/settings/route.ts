import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings, saveSettings } from "@/lib/settings/store";
import { requireStaffRole } from "@/lib/staff/permissions";

const SettingsSchema = z.object({
  clinic_name: z.string().trim().min(3).max(120),
  clinic_email: z.string().trim().email().max(120),
  clinic_phone: z.string().trim().min(5).max(60),
  clinic_address: z.string().trim().min(5).max(200),
  currency: z.string().trim().min(3).max(5),
  timezone: z.string().trim().min(2).max(60),
  default_appointment_duration: z.number().int().min(5).max(240),
  enable_email_notifications: z.boolean(),
  enable_sms_notifications: z.boolean(),
  billing_notes: z.string().trim().max(500).optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  const settings = await getSettings(supabase);
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await saveSettings(parsed.data, supabase);
  return NextResponse.json({ ok: true, settings: updated });
}
