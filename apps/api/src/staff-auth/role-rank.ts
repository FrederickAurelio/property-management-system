import { AdminRole } from '@cabin/api-contract';

/** Higher number = more privileged. Used by StaffRolesGuard as a minimum bar. */
export const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  [AdminRole.FRONT_DESK]: 1,
  [AdminRole.ADMIN]: 2,
  [AdminRole.SUPER_ADMIN]: 3,
};

export function adminRoleRank(role: AdminRole): number {
  return ADMIN_ROLE_RANK[role];
}
