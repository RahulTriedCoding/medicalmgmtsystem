"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { AttendanceStatus } from "@/lib/staff/attendance";

type StaffMember = {
  id: string;
  name: string;
  role: string;
};

type AttendanceManagerProps = {
  staff: StaffMember[];
  initialDate: string;
  initialAttendance: Record<string, AttendanceStatus | undefined>;
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "On leave",
};

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ value: value as AttendanceStatus, label })
);

function toRecordMap(entries: Array<{ staff_id: string; status: AttendanceStatus }>) {
  return entries.reduce<Record<string, AttendanceStatus>>((acc, entry) => {
    if (entry.staff_id) {
      acc[entry.staff_id] = entry.status;
    }
    return acc;
  }, {});
}

export function StaffAttendanceManager({
  staff,
  initialDate,
  initialAttendance,
}: AttendanceManagerProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | undefined>>(
    () => ({ ...initialAttendance })
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasHydrated = useRef(false);

  const fetchAttendance = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/staff/attendance?date=${encodeURIComponent(date)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to load attendance");
        }
        const payload = await res.json();
        const records = Array.isArray(payload?.attendance) ? payload.attendance : [];
        const mapped = toRecordMap(records);
        setStatuses(mapped);
      } catch (error) {
        console.error("[attendance] fetch error", error);
        toast.error(error instanceof Error ? error.message : "Failed to load attendance");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }
    fetchAttendance(selectedDate);
  }, [fetchAttendance, selectedDate]);

  const markedCount = useMemo(
    () => Object.values(statuses).filter((value) => typeof value === "string").length,
    [statuses]
  );

  const handleStatusChange = (staffId: string, status: string) => {
    setStatuses((prev) => {
      const next = { ...prev };
      if (!status) {
        delete next[staffId];
      } else {
        next[staffId] = status as AttendanceStatus;
      }
      return next;
    });
  };

  const handleSave = async () => {
    const records = staff
      .map((member) => {
        const status = statuses[member.id];
        return status ? { staffId: member.id, status } : null;
      })
      .filter(
        (record): record is { staffId: string; status: AttendanceStatus } => !!record && !!record.status
      );

    if (!records.length) {
      toast.error("Mark at least one staff member before saving.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/staff/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, records }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to save attendance");
      }
      toast.success("Attendance saved");
      await fetchAttendance(selectedDate);
    } catch (error) {
      console.error("[attendance] save error", error);
      toast.error(error instanceof Error ? error.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label htmlFor="attendance-date" className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Date
          </label>
          <input
            id="attendance-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {markedCount} marked · {staff.length} staff
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !staff.length}
            className="btn-primary text-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save attendance"}
          </button>
        </div>
      </div>

      <div className="surface overflow-hidden">
        {!staff.length ? (
          <div className="p-6 text-sm text-muted-foreground">Invite staff members to start tracking attendance.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-t">
                  <td className="p-2 font-medium text-slate-900 dark:text-white">{member.name}</td>
                  <td className="p-2 text-muted-foreground">{member.role}</td>
                  <td className="p-2">
                    <select
                      value={statuses[member.id] ?? ""}
                      onChange={(event) => handleStatusChange(member.id, event.target.value)}
                      disabled={loading || saving}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900/40 dark:text-white dark:focus:border-primary dark:focus:ring-primary/40"
                    >
                      <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                        Not marked
                      </option>
                      {STATUS_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white"
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading attendance for {selectedDate}…</p>
      )}
    </div>
  );
}
