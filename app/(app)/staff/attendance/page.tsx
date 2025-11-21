import { StaffAttendanceManager } from "@/components/staff/attendance-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";
import { getRoleLabel, normalizeStaffRole } from "@/lib/staff/types";
import type { AttendanceStatus } from "@/lib/staff/attendance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StaffRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

export default async function StaffAttendancePage() {
  const supabase = await createSupabaseServerClient();
  const staffContext = await getCurrentStaffContext(supabase);

  if (staffContext.role !== "admin") {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Attendance</h1>
        <p className="text-sm text-muted-foreground">You need admin permissions to manage attendance.</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: staffRows, error: staffError } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("is_active", true)
    .is("deactivated_at", null)
    .order("full_name", { ascending: true });

  if (staffError) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Attendance</h1>
        <p className="text-sm text-red-500 dark:text-red-400">Error: {staffError.message}</p>
      </div>
    );
  }

  const staff = (staffRows ?? []).map((row: StaffRow) => {
    const normalizedRole = normalizeStaffRole(row.role);
    return {
      id: row.id,
      name: row.full_name ?? "Staff",
      role: normalizedRole ? getRoleLabel(normalizedRole) : row.role ?? "Staff",
    };
  });

  const initialAttendance: Record<string, AttendanceStatus> = {};
  const { data: attendanceRows } = await supabase
    .from("staff_attendance")
    .select("staff_id, status, date")
    .eq("date", today);

  (attendanceRows ?? []).forEach((row) => {
    if (row.staff_id && typeof row.status === "string") {
      initialAttendance[row.staff_id] = row.status as AttendanceStatus;
    }
  });

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/50">Staff</p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Track daily presence across the care team. Only administrators can update these records.
        </p>
      </div>

      <StaffAttendanceManager
        staff={staff}
        initialDate={today}
        initialAttendance={initialAttendance}
      />
    </div>
  );
}
