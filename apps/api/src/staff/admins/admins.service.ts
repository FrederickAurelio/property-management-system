import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  ApiFieldReason,
  type StaffAdmin,
} from '@cabin/api-contract';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_ROUNDS,
  toStaffAdmin,
} from '../../common/staff/admin-mapper.js';
import {
  AdminRole as PrismaAdminRole,
  Prisma,
} from '../../generated/prisma/index.js';
import type { Admin } from '../../generated/prisma/index.js';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<StaffAdmin[]> {
    const rows = await this.prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toStaffAdmin);
  }

  async create(
    actorId: string,
    input: {
      username: string;
      password: string;
      role: AdminRole;
      currentPassword: string;
    },
  ): Promise<StaffAdmin> {
    await this.assertActorPassword(actorId, input.currentPassword);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    try {
      const created = await this.prisma.admin.create({
        data: {
          username: input.username,
          passwordHash,
          role: input.role,
        },
      });
      return toStaffAdmin(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Username is already taken',
          details: {
            field: 'username',
            reason: ApiFieldReason.USERNAME_TAKEN,
          },
        });
      }
      throw error;
    }
  }

  async changeRole(
    actorId: string,
    targetId: string,
    input: { role: AdminRole; currentPassword: string },
  ): Promise<StaffAdmin> {
    await this.assertActorPassword(actorId, input.currentPassword);

    if (targetId === actorId) {
      throw new BadRequestException('You cannot change your own role');
    }

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.admin.findUnique({ where: { id: targetId } });
      if (!target) {
        throw new NotFoundException('Admin not found');
      }

      if (
        target.role === PrismaAdminRole.SUPER_ADMIN &&
        input.role !== AdminRole.SUPER_ADMIN
      ) {
        await this.assertNotLastActiveSuper(tx, target);
      }

      const updated = await tx.admin.update({
        where: { id: targetId },
        data: { role: input.role },
      });
      return toStaffAdmin(updated);
    });
  }

  async setActive(
    actorId: string,
    targetId: string,
    input: { isActive: boolean; currentPassword: string },
  ): Promise<StaffAdmin> {
    await this.assertActorPassword(actorId, input.currentPassword);

    if (!input.isActive && targetId === actorId) {
      throw new BadRequestException('You cannot revoke your own access');
    }

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.admin.findUnique({ where: { id: targetId } });
      if (!target) {
        throw new NotFoundException('Admin not found');
      }

      if (
        !input.isActive &&
        target.isActive &&
        target.role === PrismaAdminRole.SUPER_ADMIN
      ) {
        await this.assertNotLastActiveSuper(tx, target);
      }

      const updated = await tx.admin.update({
        where: { id: targetId },
        data: { isActive: input.isActive },
      });
      return toStaffAdmin(updated);
    });
  }

  private async assertActorPassword(
    actorId: string,
    currentPassword: string,
  ): Promise<Admin> {
    const actor = await this.prisma.admin.findUnique({
      where: { id: actorId },
    });

    if (!actor || !actor.isActive) {
      throw new NotFoundException('Admin not found');
    }

    const passwordOk = await bcrypt.compare(
      currentPassword,
      actor.passwordHash,
    );
    if (!passwordOk) {
      throw new BadRequestException({
        message: 'Current password is incorrect',
        details: {
          field: 'currentPassword',
          reason: ApiFieldReason.INVALID_CURRENT_PASSWORD,
        },
      });
    }

    return actor;
  }

  private async assertNotLastActiveSuper(
    tx: Prisma.TransactionClient,
    target: Admin,
  ): Promise<void> {
    if (!target.isActive || target.role !== PrismaAdminRole.SUPER_ADMIN) {
      return;
    }

    const activeSuperCount = await tx.admin.count({
      where: {
        role: PrismaAdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    if (activeSuperCount <= 1) {
      throw new BadRequestException(
        'Cannot demote or revoke the last active super admin',
      );
    }
  }
}
