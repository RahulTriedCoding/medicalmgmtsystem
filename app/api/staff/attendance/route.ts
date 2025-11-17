import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffRole } from "@/lib/staff/permissions";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
  bulkMarkAttendance,
  getAttendanceForDate,
} from "@/lib/staff/attendance";

const AttendanceStatusEnum = z.enum(ATTENDANCE_STATUSES);

const SaveAttendanceSchema = z.object({
  date: z.string().trim().min(1),
  records: z
    .array(
      z.object({
        staffId: z.string().uuid(),
        status: AttendanceStatusEnum,
      })
    )
    .min(1),
});

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  try {
    const attendance = await getAttendanceForDate(date, supabase);
    return NextResponse.json({ ok: true, attendance });
  } catch (error) {
    console.error("[attendance] failed to load records", error);
    const message = error instanceof Error ? error.message : "Failed to load attendance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = SaveAttendanceSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const records = parsed.data.records.map((record): { staffId: string; status: AttendanceStatus; date: string; markedBy: string | null } => ({
    staffId: record.staffId,
    status: record.status,
    date: parsed.data.date,
    markedBy: guard.staffId ?? null,
  }));

  try {
    await bulkMarkAttendance(records, supabase);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[attendance] failed to save", error);
    const message = error instanceof Error ? error.message : "Failed to save attendance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
