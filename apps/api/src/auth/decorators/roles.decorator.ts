import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@cabin/api-contract';

export const ROLES_KEY = 'roles';

/**
 * Minimum role for the route. Higher roles always pass.
 * Prefer a single role: `@Roles('ADMIN')` → ADMIN + SUPER_ADMIN.
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
