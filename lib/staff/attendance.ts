import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "leave"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceRow = {
  id: string;
  staff_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarkAttendancePayload = {
  staffId: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string | null;
};

type ServerClient = SupabaseClient;

async function ensureClient(client?: ServerClient) {
  return client ?? (await createSupabaseServerClient());
}

function normalizeStatus(value: unknown): AttendanceStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (ATTENDANCE_STATUSES as readonly string[]).includes(normalized as AttendanceStatus)
    ? (normalized as AttendanceStatus)
    : null;
}

function normalizeDateInput(value: string): string {
  if (!value) {
    throw new Error("Date is required");
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Invalid date");
  }
  return dt.toISOString().slice(0, 10);
}

function mapRow(row: {
  id: string;
  staff_id: string;
  date: string;
  status: string;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
}): AttendanceRow {
  const mappedStatus = normalizeStatus(row.status);
  if (!mappedStatus) {
    throw new Error(`Unsupported attendance status: ${row.status}`);
  }
  return {
    id: row.id,
    staff_id: row.staff_id,
    date: row.date,
    status: mappedStatus,
    marked_by: row.marked_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAttendanceForDate(date: string, client?: ServerClient): Promise<AttendanceRow[]> {
  const supabase = await ensureClient(client);
  const normalizedDate = normalizeDateInput(date);
  const { data, error } = await supabase
    .from("staff_attendance")
    .select("id, staff_id, date, status, marked_by, created_at, updated_at")
    .eq("date", normalizedDate)
    .order("staff_id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function getAttendanceForStaff(staffId: string, client?: ServerClient): Promise<AttendanceRow[]> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("staff_attendance")
    .select("id, staff_id, date, status, marked_by, created_at, updated_at")
    .eq("staff_id", staffId)
    .order("date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function markAttendance(payload: MarkAttendancePayload, client?: ServerClient): Promise<AttendanceRow> {
  const supabase = await ensureClient(client);
  const status = normalizeStatus(payload.status);
  if (!status) {
    throw new Error("Invalid attendance status");
  }
  const date = normalizeDateInput(payload.date);

  const { data, error } = await supabase
    .from("staff_attendance")
    .upsert(
      {
        staff_id: payload.staffId,
        date,
        status,
        marked_by: payload.markedBy ?? null,
      },
      { onConflict: "staff_id,date" }
    )
    .select("id, staff_id, date, status, marked_by, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save attendance");
  }

  return mapRow(data);
}

export async function bulkMarkAttendance(
  records: MarkAttendancePayload[],
  client?: ServerClient
): Promise<void> {
  if (!records.length) {
    return;
  }

  const supabase = await ensureClient(client);

  const entries = records
    .map((record) => {
      const status = normalizeStatus(record.status);
      if (!status || !record.staffId) {
        return null;
      }
      const date = normalizeDateInput(record.date);
      return {
        staff_id: record.staffId,
        date,
        status,
        marked_by: record.markedBy ?? null,
      };
    })
    .filter((entry): entry is { staff_id: string; date: string; status: AttendanceStatus; marked_by: string | null } => !!entry);

  if (!entries.length) {
    throw new Error("No valid attendance records provided");
  }

  const { error } = await supabase
    .from("staff_attendance")
    .upsert(entries, { onConflict: "staff_id,date" });

  if (error) {
    throw new Error(error.message);
  }
}
