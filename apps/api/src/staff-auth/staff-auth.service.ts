import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiFieldReason, type PublicAdmin } from '@cabin/api-contract';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS, toPublicAdmin } from '../common/staff/admin-mapper.js';
import { Prisma } from '../generated/prisma/index.js';
import type { Admin } from '../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffAuthService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(admin: Admin): PublicAdmin {
    return toPublicAdmin(admin);
  }

  async validateCredentials(
    username: string,
    password: string,
  ): Promise<PublicAdmin> {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.toPublic(admin);
  }

  async changeUsername(
    adminId: string,
    username: string,
    currentPassword: string,
  ): Promise<PublicAdmin> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.isActive) {
      throw new NotFoundException('Admin not found');
    }

    if (username === admin.username) {
      throw new BadRequestException({
        message: 'Username is unchanged',
        details: {
          field: 'username',
          reason: ApiFieldReason.USERNAME_UNCHANGED,
        },
      });
    }

    const passwordOk = await bcrypt.compare(
      currentPassword,
      admin.passwordHash,
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

    try {
      const updated = await this.prisma.admin.update({
        where: { id: adminId },
        data: { username },
      });
      return this.toPublic(updated);
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

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.isActive) {
      throw new NotFoundException('Admin not found');
    }

    const passwordOk = await bcrypt.compare(
      currentPassword,
      admin.passwordHash,
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

    const sameAsCurrent = await bcrypt.compare(newPassword, admin.passwordHash);
    if (sameAsCurrent) {
      throw new BadRequestException({
        message: 'New password must differ from the current one',
        details: {
          field: 'newPassword',
          reason: ApiFieldReason.SAME_AS_CURRENT,
        },
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash },
    });

    return { ok: true };
  }
}
