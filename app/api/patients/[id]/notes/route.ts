import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClinicalNotesForPatient } from "@/lib/clinical-notes/store";
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
  const guard = await requireStaffRole(supabase, ["admin", "doctor"]);
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
