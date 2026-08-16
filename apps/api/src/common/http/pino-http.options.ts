import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import type { Options } from 'pino-http';
import type { Request, Response } from 'express';
import { createLokiPushStream } from './loki-push.stream.js';
import { shouldPushRequestLogsToLoki } from './loki-url.js';
import {
  getRequestId,
  REQUEST_ID_HEADER,
  sanitizeRequestId,
} from './request-id.middleware.js';
import {
  requestLogCustomProps,
  requestPathname,
  shouldSkipRequestLog,
} from './request-log.fields.js';

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function prettyStdoutStream(): NodeJS.WritableStream {
  try {
    // pino-pretty is a devDependency — host `pnpm dev` only. Prod image has no copy.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('pino-pretty') as
      | ((opts: object) => NodeJS.WritableStream)
      | { default: (opts: object) => NodeJS.WritableStream };
    const pretty = typeof loaded === 'function' ? loaded : loaded.default;
    return pretty({ colorize: true, singleLine: true });
  } catch {
    return process.stdout;
  }
}

export function pinoHttpOptions(): Options {
  const isProd = process.env.NODE_ENV === 'production';

  const base: Options = {
    level: isProd ? 'info' : 'debug',
    quietReqLogger: true,
    genReqId: (req: IncomingMessage) => {
      const existing = sanitizeRequestId(getRequestId(req as Request));
      if (existing) {
        return existing;
      }
      const fromHeader = sanitizeRequestId(
        headerValue(req.headers[REQUEST_ID_HEADER]),
      );
      if (fromHeader) {
        return fromHeader;
      }
      return randomUUID();
    },
    autoLogging: {
      ignore: (req: IncomingMessage) =>
        shouldSkipRequestLog(req.method, req.url),
    },
    customProps: (req: IncomingMessage, res: ServerResponse) =>
      requestLogCustomProps(req as Request, res as Response),
    customSuccessMessage: (req, res) =>
      `${req.method ?? '?'} ${requestPathname(req.url) || '?'} ${res.statusCode}`,
    customErrorMessage: (req, res) =>
      `${req.method ?? '?'} ${requestPathname(req.url) || '?'} ${res.statusCode}`,
    serializers: {
      req(req: IncomingMessage & { id?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: requestPathname(req.url),
        };
      },
      res(res: ServerResponse) {
        return { statusCode: res.statusCode };
      },
    },
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["set-cookie"]',
      ],
      censor: '[Redacted]',
    },
  };

  if (!shouldPushRequestLogsToLoki()) {
    return base;
  }

  return {
    ...base,
    stream: pino.multistream([
      { stream: createLokiPushStream() },
      { stream: isProd ? process.stdout : prettyStdoutStream() },
    ]),
  };
}
