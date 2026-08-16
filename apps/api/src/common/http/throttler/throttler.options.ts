import type { ExecutionContext } from '@nestjs/common';
import type {
  ThrottlerGenerateKeyFunction,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import type { Request } from 'express';
import {
  RATE_LIMITED_MESSAGE,
  THROTTLER_LIMITS,
  ThrottlerName,
  type ThrottlerLimitOverrides,
} from './throttler.limits.js';
import {
  clientIp,
  defaultTracker,
  isCredentialRequest,
  isPublicIcalRequest,
  isStaffLoginRequest,
  loginUsername,
} from './throttler.paths.js';

function httpRequest(context: ExecutionContext): Request {
  return context.switchToHttp().getRequest<Request>();
}

const ipOnlyKey: ThrottlerGenerateKeyFunction = (
  _context,
  tracker,
  name,
): string => `${name}:${tracker}`;

export function throttlerModuleOptions(
  overrides: ThrottlerLimitOverrides = {},
): ThrottlerModuleOptions {
  const defaultTtl = overrides.defaultTtlMs ?? THROTTLER_LIMITS.default.ttlMs;
  const defaultLimit = overrides.defaultLimit ?? THROTTLER_LIMITS.default.limit;
  const globalTtl = overrides.globalTtlMs ?? THROTTLER_LIMITS.global.ttlMs;
  const globalLimit = overrides.globalLimit ?? THROTTLER_LIMITS.global.limit;
  const authTtl = overrides.authTtlMs ?? THROTTLER_LIMITS.auth.ttlMs;
  const authLimit = overrides.authLimit ?? THROTTLER_LIMITS.auth.limit;
  const authUserTtl =
    overrides.authUserTtlMs ?? THROTTLER_LIMITS.authUser.ttlMs;
  const authUserLimit =
    overrides.authUserLimit ?? THROTTLER_LIMITS.authUser.limit;
  const icalTtl = overrides.icalTtlMs ?? THROTTLER_LIMITS.ical.ttlMs;
  const icalLimit = overrides.icalLimit ?? THROTTLER_LIMITS.ical.limit;

  return {
    errorMessage: RATE_LIMITED_MESSAGE,
    setHeaders: false,
    throttlers: [
      {
        name: ThrottlerName.default,
        ttl: defaultTtl,
        limit: defaultLimit,
        skipIf: (context) => isPublicIcalRequest(httpRequest(context)),
        getTracker: (_req, context) => defaultTracker(httpRequest(context)),
      },
      {
        name: ThrottlerName.global,
        ttl: globalTtl,
        limit: globalLimit,
        skipIf: (context) => isPublicIcalRequest(httpRequest(context)),
        getTracker: (_req, context) => clientIp(httpRequest(context)),
        generateKey: ipOnlyKey,
      },
      {
        name: ThrottlerName.ical,
        ttl: icalTtl,
        limit: icalLimit,
        skipIf: (context) => !isPublicIcalRequest(httpRequest(context)),
        getTracker: (_req, context) => clientIp(httpRequest(context)),
        generateKey: ipOnlyKey,
      },
      {
        name: ThrottlerName.auth,
        ttl: authTtl,
        limit: authLimit,
        skipIf: (context) => !isCredentialRequest(httpRequest(context)),
        getTracker: (_req, context) => clientIp(httpRequest(context)),
        generateKey: ipOnlyKey,
      },
      {
        name: ThrottlerName.authUser,
        ttl: authUserTtl,
        limit: authUserLimit,
        skipIf: (context) => {
          const req = httpRequest(context);
          return !isStaffLoginRequest(req) || loginUsername(req) === undefined;
        },
        getTracker: (_req, context) =>
          loginUsername(httpRequest(context)) ?? 'unused',
        generateKey: ipOnlyKey,
      },
    ],
  };
}
