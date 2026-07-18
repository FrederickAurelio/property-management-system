import { AdminRole, type StaffAdmin } from "@cabin/api-contract";

export type StaffRow = StaffAdmin;

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  FRONT_DESK: "Front desk",
};

export function formatRole(role: AdminRole): string {
  return ROLE_LABELS[role];
}

export function countActiveSuperAdmins(staff: StaffRow[]): number {
  return staff.filter(
    (row) => row.role === AdminRole.SUPER_ADMIN && row.isActive,
  ).length;
}
