import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffRole } from "@/lib/staff/permissions";
import {
  createClinicalNote,
  getClinicalNotesForAppointment,
} from "@/lib/clinical-notes/store";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ParamsShape = Promise<{ id?: string }>;

const BodySchema = z.object({
  note_text: z.string().trim().min(3).max(5000),
  template_key: z.string().trim().max(120).optional().nullable(),
});

async function resolveAppointment(
  supabase: SupabaseServerClient,
  id: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const id = resolved?.id ?? "";
  if (!id || typeof id !== "string") return null;
  return id;
}

export async function GET(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "doctor"]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
  }

  let appointment;
  try {
    appointment = await resolveAppointment(supabase, id);
  } catch (error) {
    console.error("[notes] load appointment error", error);
    const message = error instanceof Error ? error.message : "Failed to load appointment";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (guard.role !== "admin" && guard.staffId && appointment.doctor_id !== guard.staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const notes = await getClinicalNotesForAppointment(
      appointment.id,
      supabase,
      guard.role === "doctor" ? { doctorId: guard.staffId ?? undefined } : undefined
    );
    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    console.error("[notes] fetch notes error", error);
    const message = error instanceof Error ? error.message : "Failed to load notes";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "doctor"]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    console.error("[notes] invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let appointment;
  try {
    appointment = await resolveAppointment(supabase, id);
  } catch (error) {
    console.error("[notes] load appointment error", error);
    const message = error instanceof Error ? error.message : "Failed to load appointment";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (!appointment.doctor_id) {
    return NextResponse.json({ error: "Appointment has no doctor assigned" }, { status: 400 });
  }

  if (guard.role !== "admin" && guard.staffId && appointment.doctor_id !== guard.staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await createClinicalNote(
      {
        appointmentId: appointment.id,
        patientId: appointment.patient_id,
        doctorId: appointment.doctor_id,
        noteText: parsed.data.note_text,
        templateKey: parsed.data.template_key ?? null,
      },
      supabase
    );
    const notes = await getClinicalNotesForAppointment(
      appointment.id,
      supabase,
      guard.role === "doctor" ? { doctorId: guard.staffId ?? undefined } : undefined
    );
    return NextResponse.json({ ok: true, notes }, { status: 201 });
  } catch (error) {
    console.error("[notes] create note error", error);
    const message = error instanceof Error ? error.message : "Failed to create note";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
