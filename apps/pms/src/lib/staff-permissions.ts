import { AdminRole } from "@cabin/api-contract";

/** ADMIN and SUPER_ADMIN may create/edit/delete inventory master data. */
export function canManageInventory(role: AdminRole): boolean {
  return role === AdminRole.ADMIN || role === AdminRole.SUPER_ADMIN;
}

/** Period reports — owner/manager review; not front-desk daily ops. */
export function canViewReports(role: AdminRole): boolean {
  return role === AdminRole.ADMIN || role === AdminRole.SUPER_ADMIN;
}

/** HTTP request diary (Settings → Request logs) — ADMIN+; not FRONT_DESK. */
export function canViewRequestLogs(role: AdminRole): boolean {
  return canViewReports(role);
}
