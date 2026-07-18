import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { StaffAdmin } from '@cabin/api-contract';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { StaffAuthService } from '../staff-auth.service';

export type RequestWithAdmin = Request & { admin?: StaffAdmin };

@Injectable()
export class StaffSessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffAuthService: StaffAuthService,
  ) {}

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

    request.admin = this.staffAuthService.toPublic(admin);

    return true;
  }
}
