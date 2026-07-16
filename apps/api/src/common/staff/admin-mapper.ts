import type { PublicAdmin } from '@cabin/api-contract';
import type { Admin } from '../../generated/prisma/index.js';

export const BCRYPT_ROUNDS = 12;

export function toPublicAdmin(admin: Admin): PublicAdmin {
  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    isActive: admin.isActive,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  };
}
