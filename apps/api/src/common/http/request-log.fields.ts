import type { Request, Response } from 'express';
import type { RequestWithAdmin } from '../../staff/auth/guards/staff-session-auth.guard.js';
import { getRequestId } from './request-id.middleware.js';

export const CABIN_APP_HEADER = 'x-cabin-app';

export const ERROR_CODE_LOCAL = 'errorCode';
export const ERROR_MESSAGE_LOCAL = 'errorMessage';

const MAX_ERROR_MESSAGE_CHARS = 200;

export type CabinApp = 'pms' | 'web' | '-';
export type CabinAudience = 'staff' | 'public' | 'infra';

export function cabinAppFromRequest(req: Request): CabinApp {
  const header = req.header(CABIN_APP_HEADER)?.trim().toLowerCase();
  if (header === 'pms' || header === 'web') {
    return header;
  }

  const origin = req.header('origin') ?? '';
  try {
    const { port, hostname } = new URL(origin);
    if (port === '5173' || port === '8080') {
      return 'pms';
    }
    if (port === '5174' || port === '3050') {
      return 'web';
    }
    if (
      (hostname === 'localhost' || hostname === '127.0.0.1') &&
      (port === '' || port === '80' || port === '443')
    ) {
      return '-';
    }
  } catch {
    return '-';
  }

  return '-';
}

export function cabinAudienceFromRequest(req: Request): CabinAudience {
  const path = req.originalUrl ?? req.url ?? '';
  if (path.startsWith('/staff')) {
    return 'staff';
  }
  if (path.startsWith('/public')) {
    return 'public';
  }
  return 'infra';
}

export function cabinActorFromRequest(req: Request): string {
  const username = (req as RequestWithAdmin).admin?.username?.trim();
  return username && username.length > 0 ? username : '-';
}

export function shortErrorMessage(message: string): string {
  const trimmed = message.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= MAX_ERROR_MESSAGE_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_ERROR_MESSAGE_CHARS)}…`;
}

export function attachRequestLogError(
  res: Response,
  code: string,
  message: string,
): void {
  if (!res.locals) {
    return;
  }
  res.locals[ERROR_CODE_LOCAL] = code;
  res.locals[ERROR_MESSAGE_LOCAL] = shortErrorMessage(message);
}

/**
 * What was actually thrown — for the request-log row, not the FE envelope.
 * Unexpected 500s stay generic on the wire; the diary keeps Error.name + first line.
 */
export function thrownErrorForRequestLog(exception: unknown): string {
  if (exception instanceof Error) {
    const firstLine =
      exception.message
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim() ?? '';
    const name = exception.name.trim();
    if (name && name !== 'Error' && firstLine) {
      return `${name}: ${firstLine}`;
    }
    if (firstLine) {
      return firstLine;
    }
    if (name) {
      return name;
    }
    return 'Unknown error';
  }
  if (typeof exception === 'string' && exception.trim().length > 0) {
    return exception.trim();
  }
  return 'Unknown error';
}

/** Pathname only — never log `?token=` or other query strings. */
export function requestPathname(url: string | undefined): string {
  if (!url) {
    return '';
  }
  const withoutQuery = url.split('?')[0] ?? url;
  return withoutQuery.split('#')[0] ?? withoutQuery;
}

/**
 * Skip pino-http autoLogging (stdout + Loki push).
 * `/health` probes, OTA iCal pollers, and the diary GET are not desk bugs.
 * iCal **cron** Nest Logger lines are unchanged — they stay in Docker for SSH.
 */
export function shouldSkipRequestLog(
  method: string | undefined,
  url: string | undefined,
): boolean {
  const path = requestPathname(url);
  if (path === '/health') {
    return true;
  }
  if (path.startsWith('/public/ical/')) {
    return true;
  }
  return (
    (method ?? '').toUpperCase() === 'GET' && path === '/staff/request-logs'
  );
}

export function requestLogCustomProps(
  req: Request,
  res: Response,
): Record<string, string | undefined> {
  const status = res.statusCode;
  const path = requestPathname(req.originalUrl ?? req.url);
  const props: Record<string, string | undefined> = {
    requestId: getRequestId(req),
    app: cabinAppFromRequest(req),
    audience: cabinAudienceFromRequest(req),
    actor: cabinActorFromRequest(req),
    ...(path ? { path } : {}),
  };

  if (status >= 400) {
    const locals = res.locals as Record<string, unknown> | undefined;
    const code = locals?.[ERROR_CODE_LOCAL];
    const errorMessage = locals?.[ERROR_MESSAGE_LOCAL];
    if (typeof code === 'string' && code.length > 0) {
      props.errorCode = code;
    }
    if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      props.errorMessage = errorMessage;
    }
  }

  return props;
}
