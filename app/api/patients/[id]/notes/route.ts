import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createClinicalNote,
  getClinicalNotesForPatient,
} from "@/lib/clinical-notes/store";
import { requireStaffRole } from "@/lib/staff/permissions";

type ParamsShape = Promise<{ id?: string }>;

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const id = resolved?.id ?? "";
  if (!id || typeof id !== "string") return null;
  return id;
}

export async function GET(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, [
    "admin",
    "doctor",
    "nurse",
    "receptionist",
  ]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid patient id" }, { status: 400 });
  }

  try {
    const notes = await getClinicalNotesForPatient(
      id,
      supabase,
      guard.role === "doctor" ? { doctorId: guard.staffId ?? undefined } : undefined
    );
    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notes";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "doctor"]);
  if ("response" in guard) return guard.response;

  const patientId = await resolveId(params);
  if (!patientId) {
    return NextResponse.json({ error: "Invalid patient id" }, { status: 400 });
  }

  if (!guard.staffId) {
    return NextResponse.json({ error: "Staff profile missing" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const noteText =
    typeof (body as { note_text?: unknown })?.note_text === "string"
      ? (body as { note_text: string }).note_text
      : "";
  const appointmentId =
    typeof (body as { appointment_id?: unknown })?.appointment_id === "string"
      ? ((body as { appointment_id: string }).appointment_id || null)
      : null;

  if (!noteText.trim()) {
    return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  }

  try {
    const note = await createClinicalNote(
      {
        appointmentId,
        patientId,
        doctorId: guard.staffId,
        noteText,
      },
      supabase
    );
    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save note";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
