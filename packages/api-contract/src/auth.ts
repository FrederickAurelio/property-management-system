/** Staff roles (wire + API guards). Keep in sync with Prisma `AdminRole`. */
export const AdminRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  FRONT_DESK: 'FRONT_DESK',
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

/** Staff admin as returned by `/auth/*` (JSON dates are ISO strings). */
export type PublicAdmin = {
  id: string;
  username: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
