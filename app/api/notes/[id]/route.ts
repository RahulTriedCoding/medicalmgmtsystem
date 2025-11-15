import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffRole } from "@/lib/staff/permissions";
import { updateClinicalNote } from "@/lib/clinical-notes/store";

type ParamsShape = Promise<{ id?: string }>;

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const id = resolved?.id ?? "";
  return typeof id === "string" && id.length ? id : null;
}

export async function PATCH(request: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "doctor"]);
  if ("response" in guard) return guard.response;

  const noteId = await resolveId(params);
  if (!noteId) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
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

  if (!noteText.trim()) {
    return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  }

  try {
    const note = await updateClinicalNote(
      noteId,
      {
        noteText,
      },
      supabase
    );
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update note";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
