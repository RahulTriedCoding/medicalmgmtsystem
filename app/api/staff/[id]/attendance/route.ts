import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffRole } from "@/lib/staff/permissions";
import { STAFF_ROLES } from "@/lib/staff/types";
import { getAttendanceForStaff } from "@/lib/staff/attendance";

const StaffIdParamSchema = z.object({
  id: z.string().uuid(),
});

const ALLOWED_ROLES = [...STAFF_ROLES];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ALLOWED_ROLES);
  if ("response" in guard) return guard.response;

  const params = await context.params;
  const parsed = StaffIdParamSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }

  const staffId = parsed.data.id;
  if (guard.role !== "admin" && guard.staffId !== staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const attendance = await getAttendanceForStaff(staffId, supabase);
    return NextResponse.json({ ok: true, attendance });
  } catch (error) {
    console.error("[attendance] failed to load staff history", error);
    const message = error instanceof Error ? error.message : "Failed to load attendance history";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
