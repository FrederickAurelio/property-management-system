import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { PublicAdmin } from '@cabin/api-contract';
import * as bcrypt from 'bcrypt';
import type { Admin } from '../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffAuthService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(admin: Admin): PublicAdmin {
    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
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
}
