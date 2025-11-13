import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const AppointmentSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  duration: z.number().int().positive().max(24 * 60).optional(),
  reason: z.string().trim().max(200).optional().nullable(),
});

type GuardResult = { response: NextResponse } | { role: string };

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

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "receptionist", "doctor"]);
  if ("response" in guard) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = new Date(parsed.data.ends_at);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "Invalid datetime" }, { status: 400 });
  }
  if (endsAt <= startsAt) {
    return NextResponse.json({ error: "starts_at must be before ends_at" }, { status: 400 });
  }

  const duration =
    parsed.data.duration ?? Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));

  const [patientResult, doctorResult] = await Promise.all([
    supabase.from("patients").select("id").eq("id", parsed.data.patient_id).maybeSingle(),
    supabase
      .from("users")
      .select("id")
      .eq("id", parsed.data.doctor_id)
      .eq("role", "doctor")
      .maybeSingle(),
  ]);

  if (patientResult.error) {
    return NextResponse.json({ error: patientResult.error.message }, { status: 400 });
  }
  if (doctorResult.error) {
    return NextResponse.json({ error: doctorResult.error.message }, { status: 400 });
  }
  if (!patientResult.data) {
    return NextResponse.json({ error: "Patient not found" }, { status: 400 });
  }
  if (!doctorResult.data) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() === "" ? null : parsed.data.reason ?? null;

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: parsed.data.patient_id,
      doctor_id: parsed.data.doctor_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration,
      reason,
      status: "scheduled",
    })
    .select(
      "id, patient_id, doctor_id, starts_at, ends_at, duration, reason, status"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, appointment: data });
}
