import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { PublicAdmin } from '@cabin/api-contract';
import type { RequestWithAdmin } from '../guards/staff-session-auth.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicAdmin => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();
    if (!request.admin) {
      throw new UnauthorizedException('Not authenticated');
    }
    return request.admin;
  },
);
