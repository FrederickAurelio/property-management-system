import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@cabin/api-contract';
import { STAFF_ROLES_KEY } from '../decorators/staff-roles.decorator';
import { adminRoleRank } from '../role-rank';
import type { RequestWithAdmin } from './staff-session-auth.guard';

/**
 * Minimum-role check: `@StaffRoles(X)` allows X and every role above X.
 * Hierarchy: SUPER_ADMIN > ADMIN > FRONT_DESK.
 * If several roles are listed, the lowest listed rank is the bar.
 */
@Injectable()
export class StaffRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      STAFF_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const role = request.admin?.role;

    if (!role) {
      throw new ForbiddenException('Insufficient role');
    }

    const minRequiredRank = Math.min(
      ...requiredRoles.map((required) => adminRoleRank(required)),
    );

    if (adminRoleRank(role) < minRequiredRank) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
