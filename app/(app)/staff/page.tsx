import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewStaffButton } from "@/components/staff/new-staff";
import { StaffRoleSelect } from "@/components/staff/staff-role-select";
import { RemoveStaffButton } from "@/components/staff/remove-staff-button";
import { StaffRole, normalizeStaffRole } from "@/lib/staff/types";
import { getStaffContacts } from "@/lib/staff/store";
import { getCurrentStaffContext } from "@/lib/staff/current";

type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  phone: string | null;
  created_at: string;
  auth_user_id: string | null;
  pending: boolean;
  is_active: boolean;
  deactivated_at: string | null;
};

function formatDate(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type RawStaffRow = {
  id?: unknown;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  created_at?: string | null;
  auth_user_id?: string | null;
  is_active?: boolean | null;
  deactivated_at?: string | null;
};

function isRawStaffRow(row: unknown): row is RawStaffRow {
  return typeof row === "object" && row !== null && typeof (row as RawStaffRow).id === "string";
}

function coerceStaff(rows: unknown[]): StaffRow[] {
  return rows.filter(isRawStaffRow).map((row) => ({
    id: row.id as string,
    full_name: row.full_name ?? "Staff",
    email: row.email ?? "unknown",
    role: normalizeStaffRole(row.role) ?? "doctor",
    phone: null,
    created_at: row.created_at ?? new Date().toISOString(),
    auth_user_id: row.auth_user_id ?? null,
    pending: false,
    is_active: row.is_active !== false && !row.deactivated_at,
    deactivated_at: row.deactivated_at ?? null,
  }));
}

export default async function StaffPage() {
  const supabase = await createSupabaseServerClient();
  const staffContext = await getCurrentStaffContext(supabase);

  if (staffContext.role !== "admin") {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Staff & roles</h1>
        <p className="text-sm text-muted-foreground">You need admin permissions to manage staff.</p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, created_at, auth_user_id, is_active, deactivated_at")
    .order("full_name", { ascending: true });

  const contacts = await getStaffContacts(supabase);
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
  const staff = coerceStaff(data ?? []).map((member) => ({
    ...member,
    phone: contactMap.get(member.id)?.phone ?? null,
    pending: contactMap.get(member.id)?.pending ?? false,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Staff & roles</h1>
          <p className="text-sm text-muted-foreground">
            Manage clinic access for admins, doctors, nurses, and support teams.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/staff/attendance" className="btn-primary text-sm whitespace-nowrap">
            Attendance
          </Link>
          <NewStaffButton />
        </div>
      </div>

      {error && <div className="text-sm text-red-400">Error: {error.message}</div>}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Joined</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!staff.length ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No staff members yet.
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} className="border-t">
                  <td className="p-2 font-medium">{member.full_name}</td>
                  <td className="p-2">{member.email}</td>
                  <td className="p-2">
                    <StaffRoleSelect id={member.id} role={member.role} disabled={!member.is_active} />
                  </td>
                  <td className="p-2">{member.phone ?? "—"}</td>
                  <td className="p-2">
                    {(() => {
                      const isRevoked = !!member.deactivated_at || !member.is_active;
                      const classes = isRevoked
                        ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        : member.pending
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100";
                      const label = isRevoked ? "Access revoked" : member.pending ? "Invite pending" : "Active";
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-xs ${classes}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-2">{formatDate(member.created_at)}</td>
                  <td className="p-2">
                    <RemoveStaffButton id={member.id} name={member.full_name} disabled={!member.is_active} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
