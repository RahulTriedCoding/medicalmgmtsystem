import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewStaffButton } from "@/components/staff/new-staff";
import { StaffRoleSelect } from "@/components/staff/staff-role-select";
import { RemoveStaffButton } from "@/components/staff/remove-staff-button";
import { StaffRole, isStaffRole } from "@/lib/staff/types";
import { getStaffContacts } from "@/lib/staff/store";

type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  phone: string | null;
  created_at: string;
  auth_user_id: string | null;
  pending: boolean;
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
};

function isRawStaffRow(row: unknown): row is RawStaffRow {
  return typeof row === "object" && row !== null && typeof (row as RawStaffRow).id === "string";
}

function coerceStaff(rows: unknown[]): StaffRow[] {
  return rows.filter(isRawStaffRow).map((row) => ({
    id: row.id as string,
    full_name: row.full_name ?? "Staff",
    email: row.email ?? "unknown",
    role: isStaffRole(row.role) ? row.role : "doctor",
    phone: null,
    created_at: row.created_at ?? new Date().toISOString(),
    auth_user_id: row.auth_user_id ?? null,
    pending: false,
  }));
}

export default async function StaffPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: staffRecord } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    role = staffRecord?.role ?? null;
  }

  if (role !== "admin") {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Staff & roles</h1>
        <p className="text-sm text-muted-foreground">You need admin permissions to manage staff.</p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, created_at, auth_user_id")
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
        <NewStaffButton />
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
                    <StaffRoleSelect id={member.id} role={member.role} />
                  </td>
                  <td className="p-2">{member.phone ?? "—"}</td>
                  <td className="p-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        member.pending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {member.pending ? "Invite pending" : "Active"}
                    </span>
                  </td>
                  <td className="p-2">{formatDate(member.created_at)}</td>
                  <td className="p-2">
                    <RemoveStaffButton id={member.id} name={member.full_name} />
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
