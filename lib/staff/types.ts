export const STAFF_ROLES = ["admin", "doctor", "nurse", "receptionist", "billing"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function normalizeStaffRole(value: unknown): StaffRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (STAFF_ROLES as readonly string[]).includes(normalized as StaffRole)
    ? (normalized as StaffRole)
    : null;
}

export function isStaffRole(value: unknown): value is StaffRole {
  return normalizeStaffRole(value) !== null;
}

export function getRoleLabel(role: StaffRole) {
  switch (role) {
    case "admin":
      return "Administrator";
    case "doctor":
      return "Doctor";
    case "nurse":
      return "Nurse";
    case "receptionist":
      return "Receptionist";
    case "billing":
      return "Billing";
    default:
      return role;
  }
}
