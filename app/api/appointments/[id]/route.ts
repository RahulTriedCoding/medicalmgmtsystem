import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffRole } from "@/lib/staff/permissions";

type ParamsShape = Promise<{ id?: string }>;

const IdSchema = z.object({ id: z.string().uuid() });
const UpdateSchema = z.object({
  patient_id: z.string().uuid().optional(),
  doctor_id: z.string().uuid().optional(),
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
  duration: z.number().int().positive().max(24 * 60).optional(),
  reason: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]).optional(),
});
type UpdateData = z.infer<typeof UpdateSchema>;

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const parsed = IdSchema.safeParse({ id: resolved?.id ?? "" });
  if (!parsed.success) return null;
  return parsed.data.id;
}

export async function PATCH(req: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "receptionist", "doctor"]);
  if ("response" in guard) return guard.response;

  const appointmentId = await resolveId(params);
  if (!appointmentId) {
    return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
  }

  const existingResult = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id, starts_at, ends_at, duration, reason, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (existingResult.error) {
    return NextResponse.json({ error: existingResult.error.message }, { status: 400 });
  }

  if (!existingResult.data) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (guard.role === "doctor" && (!guard.staffId || guard.staffId !== existingResult.data.doctor_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = UpdateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: UpdateData = parsed.data;
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  if (guard.role === "doctor" && updates.doctor_id && updates.doctor_id !== existingResult.data.doctor_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (updates.patient_id && updates.patient_id !== existingResult.data.patient_id) {
    const { data, error } = await supabase.from("patients").select("id").eq("id", updates.patient_id).maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
  }

  if (updates.doctor_id && updates.doctor_id !== existingResult.data.doctor_id) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("id", updates.doctor_id)
      .eq("role", "doctor")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }
  }

  const nextStarts = updates.starts_at ?? existingResult.data.starts_at;
  const nextEnds = updates.ends_at ?? existingResult.data.ends_at;
  const startsAt = new Date(nextStarts);
  const endsAt = new Date(nextEnds);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "Invalid datetime" }, { status: 400 });
  }

  let duration =
    updates.duration ??
    existingResult.data.duration ??
    Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));

  if ((updates.starts_at || updates.ends_at) && !updates.duration) {
    duration = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  if (endsAt <= startsAt) {
    return NextResponse.json({ error: "starts_at must be before ends_at" }, { status: 400 });
  }

  const reason =
    updates.reason !== undefined
      ? updates.reason?.trim()
        ? updates.reason.trim()
        : null
      : existingResult.data.reason;

  const payload = {
    patient_id: updates.patient_id ?? existingResult.data.patient_id,
    doctor_id: updates.doctor_id ?? existingResult.data.doctor_id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    duration,
    reason,
    status: updates.status ?? existingResult.data.status,
  };

  const { data, error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("id", appointmentId)
    .select("id, patient_id, doctor_id, starts_at, ends_at, duration, reason, status")
    .single();

  if (error) {
    console.error("[appointments] update error", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, appointment: data });
}

export async function DELETE(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "receptionist"]);
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
