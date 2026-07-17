import { AdminRole } from "@cabin/api-contract";

/** ADMIN and SUPER_ADMIN may create/edit/delete inventory master data. */
export function canManageInventory(role: AdminRole): boolean {
  return role === AdminRole.ADMIN || role === AdminRole.SUPER_ADMIN;
}
