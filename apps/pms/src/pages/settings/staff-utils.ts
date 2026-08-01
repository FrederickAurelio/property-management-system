import { AdminRole, type StaffAdmin } from "@cabin/api-contract";
import i18n from "@/i18n";

export type StaffRow = StaffAdmin;

export function formatRole(role: AdminRole): string {
  switch (role) {
    case AdminRole.SUPER_ADMIN:
      return i18n.t("settings:roles.superAdmin");
    case AdminRole.ADMIN:
      return i18n.t("settings:roles.admin");
    case AdminRole.FRONT_DESK:
      return i18n.t("settings:roles.frontDesk");
    default:
      return role;
  }
}

export function countActiveSuperAdmins(staff: StaffRow[]): number {
  return staff.filter(
    (row) => row.role === AdminRole.SUPER_ADMIN && row.isActive,
  ).length;
}
