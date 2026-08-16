import {
  STAFF_REQUEST_LOG_APPS,
  STAFF_REQUEST_LOG_AUDIENCES,
  type StaffRequestLogApp,
  type StaffRequestLogAudience,
  type StaffRequestLogItem,
} from '@cabin/api-contract';

type PinoReq = {
  method?: unknown;
  url?: unknown;
};

type PinoRes = {
  statusCode?: unknown;
};

type PinoRequestLine = {
  req?: PinoReq;
  res?: PinoRes;
  responseTime?: unknown;
  requestId?: unknown;
  path?: unknown;
  app?: unknown;
  audience?: unknown;
  actor?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

function mapApp(value: unknown): StaffRequestLogApp {
  const raw = asString(value);
  if (raw && (STAFF_REQUEST_LOG_APPS as readonly string[]).includes(raw)) {
    return raw as StaffRequestLogApp;
  }
  return '-';
}

function mapAudience(value: unknown): StaffRequestLogAudience {
  const raw = asString(value);
  if (raw && (STAFF_REQUEST_LOG_AUDIENCES as readonly string[]).includes(raw)) {
    return raw as StaffRequestLogAudience;
  }
  return 'infra';
}

function isoFromLokiNs(nsTs: string): string | null {
  try {
    const ms = Number(BigInt(nsTs) / 1_000_000n);
    if (!Number.isFinite(ms)) {
      return null;
    }
    const iso = new Date(ms).toISOString();
    return iso;
  } catch {
    return null;
  }
}

function parsePinoLine(line: string): PinoRequestLine | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function unwrapLogLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) {
    return trimmed;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const rec = asRecord(parsed);
    if (rec && typeof rec.log === 'string' && typeof rec.stream === 'string') {
      return rec.log.replace(/\n$/, '');
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

/** Map a Loki stream value `[ns, line]` to a staff wire row, or drop noise. */
export function mapLokiEntry(
  nsTs: string,
  line: string,
): StaffRequestLogItem | null {
  const time = isoFromLokiNs(nsTs);
  if (!time) {
    return null;
  }

  const parsed = parsePinoLine(unwrapLogLine(line));
  if (!parsed) {
    return null;
  }

  const req = asRecord(parsed.req);
  const res = asRecord(parsed.res);
  const method = asString(req?.method)?.toUpperCase();
  const rawPath = asString(parsed.path) ?? asString(req?.url);
  const path = rawPath ? (rawPath.split('?')[0] ?? rawPath) : undefined;
  const status = asFiniteNumber(res?.statusCode);
  if (!method || !path || status === undefined || status < 100) {
    return null;
  }

  const durationMs = asFiniteNumber(parsed.responseTime) ?? 0;
  const requestId = asString(parsed.requestId) ?? '-';
  const actor = asString(parsed.actor) ?? '-';
  const errorCode = asString(parsed.errorCode);
  const errorMessage = asString(parsed.errorMessage);

  const item: StaffRequestLogItem = {
    time,
    actor,
    app: mapApp(parsed.app),
    audience: mapAudience(parsed.audience),
    method,
    path,
    status,
    durationMs,
    requestId,
  };

  if (errorCode) {
    item.errorCode = errorCode;
  }
  if (errorMessage) {
    item.errorMessage = errorMessage;
  }

  return item;
}
