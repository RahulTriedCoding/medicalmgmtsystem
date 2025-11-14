import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ParamsShape = Promise<{ id?: string }>;

const IdSchema = z.object({ id: z.string().uuid() });
const PatchSchema = z.object({
  patient_id: z.string().uuid().optional(),
  doctor_id: z.string().uuid().optional(),
  starts_at: z.coerce.date().transform((d) => d.toISOString()).optional(),
  ends_at: z.coerce.date().transform((d) => d.toISOString()).optional(),
  duration: z.number().int().positive().optional(),
  reason: z.string().max(200).optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
});
type PatchData = z.infer<typeof PatchSchema>;

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

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const parsed = IdSchema.safeParse({ id: resolved?.id ?? "" });
  if (!parsed.success) return null;
  return parsed.data.id;
}

export async function PATCH(req: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "receptionist", "doctor"]);
  if ("response" in guard) return guard.response;

  const appointmentId = await resolveId(params);
  if (!appointmentId) {
    return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let updates: PatchData | null = null;
  if (body && Object.keys(body as Record<string, unknown>).length) {
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    updates = parsed.data;
  }

  const payload: PatchData = updates && Object.keys(updates).length ? updates : { status: "cancelled" };

  const { error } = await supabase.from("appointments").update(payload).eq("id", appointmentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "receptionist"]);
  if ("response" in guard) return guard.response;

  const appointmentId = await resolveId(params);
  if (!appointmentId) {
    return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
  }

  const { error } = await supabase.from("appointments").delete().eq("id", appointmentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
