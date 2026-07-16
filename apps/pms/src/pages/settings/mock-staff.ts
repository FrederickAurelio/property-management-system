import { AdminRole, type PublicAdmin } from "@cabin/api-contract";

/** Mock staff list until `/admins` API exists. Mirrors Prisma `Admin` + `isActive`. */
export type StaffRow = PublicAdmin;

export const MOCK_STAFF: StaffRow[] = [
  {
    id: "admin_seed",
    username: "super",
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    createdAt: "2026-01-10T08:00:00.000Z",
    updatedAt: "2026-01-10T08:00:00.000Z",
  },
  {
    id: "admin_ops",
    username: "ops.manager",
    role: AdminRole.ADMIN,
    isActive: true,
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-06-12T14:30:00.000Z",
  },
  {
    id: "admin_desk",
    username: "front.desk",
    role: AdminRole.FRONT_DESK,
    isActive: true,
    createdAt: "2026-03-15T09:00:00.000Z",
    updatedAt: "2026-07-01T11:00:00.000Z",
  },
  {
    id: "admin_old",
    username: "seasonal.desk",
    role: AdminRole.FRONT_DESK,
    isActive: false,
    createdAt: "2025-11-01T09:00:00.000Z",
    updatedAt: "2026-04-20T16:00:00.000Z",
  },
];

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
