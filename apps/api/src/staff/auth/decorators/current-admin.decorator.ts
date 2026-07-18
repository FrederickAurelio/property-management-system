import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { StaffAdmin } from '@cabin/api-contract';
import type { RequestWithAdmin } from '../guards/staff-session-auth.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffAdmin => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();
    if (!request.admin) {
      throw new UnauthorizedException('Not authenticated');
    }
    return request.admin;
  },
);
