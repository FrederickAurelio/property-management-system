import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { PublicAdmin } from '../auth.service';

export type RequestWithAdmin = Request & { admin?: PublicAdmin };

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const adminId = request.session?.adminId;

    if (!adminId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.isActive) {
      request.session.adminId = undefined;
      throw new UnauthorizedException('Not authenticated');
    }

    request.admin = {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };

    return true;
  }
}
