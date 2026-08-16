import {
  REQUEST_LOGS_DEFAULT_WINDOW_MS,
  REQUEST_LOGS_LOOKBACK_MS,
} from "@cabin/api-contract";

export const REQUEST_LOG_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type RequestLogRange = (typeof REQUEST_LOG_RANGES)[number];

export const DEFAULT_REQUEST_LOG_RANGE: RequestLogRange = "24h";

const RANGE_MS: Record<RequestLogRange, number> = {
  "1h": 60 * 60 * 1000,
  "24h": REQUEST_LOGS_DEFAULT_WINDOW_MS,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": REQUEST_LOGS_LOOKBACK_MS,
};

export function parseRequestLogRange(raw: string | null): RequestLogRange {
  if (raw && (REQUEST_LOG_RANGES as readonly string[]).includes(raw)) {
    return raw as RequestLogRange;
  }
  return DEFAULT_REQUEST_LOG_RANGE;
}

export function rangeToFromTo(
  range: RequestLogRange,
  nowMs = Date.now(),
): { from: string; to: string } {
  const to = new Date(nowMs);
  const from = new Date(nowMs - RANGE_MS[range]);
  return { from: from.toISOString(), to: to.toISOString() };
}
