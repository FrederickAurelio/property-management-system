import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { isHealthRequest } from './throttler.paths.js';

@Injectable()
export class CabinThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(
      isHealthRequest(context.switchToHttp().getRequest<Request>()),
    );
  }
}
