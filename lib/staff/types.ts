export const STAFF_ROLES = ["admin", "doctor", "nurse", "receptionist", "billing"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value as StaffRole);
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
