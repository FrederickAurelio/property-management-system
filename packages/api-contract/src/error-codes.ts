export const ApiErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  /** Nest 429: throttler (login / IP ceiling). Not a field error. */
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** FE-only: browser/network failure (no HTTP response). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** FE-only: request aborted or exceeded client timeout. */
  TIMEOUT: 'TIMEOUT',
  /** FE-only: connection refused or gateway 502/503/504. */
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  /** Nest 503: Loki down / timeout — request-log search unavailable. */
  LOGS_UNAVAILABLE: 'LOGS_UNAVAILABLE',
  /** Nest 503: Gotenberg down / timeout — utility statement PDF unavailable. */
  PDF_UNAVAILABLE: 'PDF_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
