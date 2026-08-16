import type { Paginated } from './pagination.js';

/** Newest lines Nest asks Loki for in one window (then slices `page`). */
export const REQUEST_LOGS_QUERY_CAP = 500;

/** Max lookback (matches Loki `retention_period` / `max_query_lookback`). */
export const REQUEST_LOGS_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

/** Default list window when PMS opens Request logs. */
export const REQUEST_LOGS_DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const REQUEST_LOGS_Q_MAX = 128;
export const REQUEST_LOGS_ACTOR_MAX = 64;
export const REQUEST_LOGS_PATH_MAX = 256;
export const REQUEST_LOGS_REQUEST_ID_MAX = 64;
/** Incoming `x-request-id` and toast paste. UUID fits. Junk headers are ignored. */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export const STAFF_REQUEST_LOG_APPS = ['pms', 'web', '-'] as const;
export type StaffRequestLogApp = (typeof STAFF_REQUEST_LOG_APPS)[number];

export const STAFF_REQUEST_LOG_AUDIENCES = [
  'staff',
  'public',
  'infra',
] as const;
export type StaffRequestLogAudience =
  (typeof STAFF_REQUEST_LOG_AUDIENCES)[number];

/** One Nest HTTP request line after mapping Loki → wire. */
export type StaffRequestLogItem = {
  time: string;
  actor: string;
  app: StaffRequestLogApp;
  audience: StaffRequestLogAudience;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId: string;
  errorCode?: string;
  errorMessage?: string;
};

/** Query params for `GET /staff/request-logs`. */
export type StaffRequestLogsParams = {
  page?: number;
  pageSize?: number;
  /** Inclusive window start (ISO-8601). */
  from?: string;
  /** Inclusive window end (ISO-8601). */
  to?: string;
  q?: string;
  app?: 'pms' | 'web';
  actor?: string;
  path?: string;
  errorsOnly?: boolean;
  requestId?: string;
};

/**
 * Paginated request-log window. `truncated` means Loki returned the query cap
 * — older lines in the window were not fetched; narrow the time range.
 */
export type StaffRequestLogsList = Paginated<StaffRequestLogItem> & {
  truncated: boolean;
};
