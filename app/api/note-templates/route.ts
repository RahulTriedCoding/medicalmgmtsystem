import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffRole } from "@/lib/staff/permissions";
import { getNoteTemplates } from "@/lib/clinical-notes/templates";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "doctor"]);
  if ("response" in guard) return guard.response;

  try {
    const templates = await getNoteTemplates(supabase);
    return NextResponse.json({ ok: true, templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load note templates";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
