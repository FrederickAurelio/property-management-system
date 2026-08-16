import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  REQUEST_ID_PATTERN,
  REQUEST_LOGS_REQUEST_ID_MAX,
} from '@cabin/api-contract';

export const REQUEST_ID_HEADER = 'x-request-id';

export type RequestWithId = Request & { requestId?: string; id?: string };

/** Accept a client `x-request-id` only when it is a short, safe id. Else undefined. */
export function sanitizeRequestId(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value || value.length > REQUEST_LOGS_REQUEST_ID_MAX) {
    return undefined;
  }
  if (!REQUEST_ID_PATTERN.test(value)) {
    return undefined;
  }
  return value;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const incoming = sanitizeRequestId(req.header(REQUEST_ID_HEADER));
  const fromPino =
    typeof req.id === 'string' ? sanitizeRequestId(req.id) : undefined;
  const requestId = incoming ?? fromPino ?? randomUUID();

  req.requestId = requestId;
  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function getRequestId(req: Request): string | undefined {
  return (req as RequestWithId).requestId;
}
