import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Admin, AdminRole } from '../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';

export type PublicAdmin = {
  id: string;
  username: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(admin: Admin): PublicAdmin {
    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
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
