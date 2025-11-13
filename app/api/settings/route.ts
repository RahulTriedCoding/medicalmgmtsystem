import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings, saveSettings } from "@/lib/settings/store";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type GuardResult = { response: NextResponse } | { role: string };

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

async function requireRole(
  supabase: SupabaseServerClient,
  allowed: string[]
): Promise<GuardResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: staff, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
  }

  const role = staff?.role ?? null;
  if (!role || !allowed.includes(role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { role };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  const settings = await getSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin"]);
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

  const updated = await saveSettings(parsed.data);
  return NextResponse.json({ ok: true, settings: updated });
}
