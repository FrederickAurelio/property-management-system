import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PublicAdmin } from '../auth.service';

type RequestWithAdmin = Request & { admin?: PublicAdmin };

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicAdmin => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();
    if (!request.admin) {
      throw new UnauthorizedException('Not authenticated');
    }
    return request.admin;
  },
);
