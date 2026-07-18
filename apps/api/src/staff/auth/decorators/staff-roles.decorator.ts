import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@cabin/api-contract';

export const STAFF_ROLES_KEY = 'staffRoles';

/**
 * Minimum staff role for the route. Higher roles always pass.
 * Prefer a single role: `@StaffRoles('ADMIN')` → ADMIN + SUPER_ADMIN.
 */
export const StaffRoles = (...roles: AdminRole[]) =>
  SetMetadata(STAFF_ROLES_KEY, roles);
