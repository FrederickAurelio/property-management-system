/** In-process throttler ceilings. Not env — Phase 1 is one API replica. */

export const RATE_LIMITED_MESSAGE =
  'Too many requests. Try again in a few minutes.';

export const ThrottlerName = {
  default: 'default',
  global: 'global',
  ical: 'ical',
  auth: 'auth',
  authUser: 'authUser',
} as const;

export type ThrottlerName = (typeof ThrottlerName)[keyof typeof ThrottlerName];

export const THROTTLER_LIMITS = {
  default: { ttlMs: 60_000, limit: 120 },
  global: { ttlMs: 60_000, limit: 300 },
  /** OTA poll burst: 300 units × a few retries from one crawler IP. */
  ical: { ttlMs: 60_000, limit: 1200 },
  auth: { ttlMs: 15 * 60_000, limit: 20 },
  authUser: { ttlMs: 15 * 60_000, limit: 20 },
} as const;

export type ThrottlerLimitOverrides = {
  defaultLimit?: number;
  defaultTtlMs?: number;
  globalLimit?: number;
  globalTtlMs?: number;
  authLimit?: number;
  authTtlMs?: number;
  authUserLimit?: number;
  authUserTtlMs?: number;
  icalLimit?: number;
  icalTtlMs?: number;
};
