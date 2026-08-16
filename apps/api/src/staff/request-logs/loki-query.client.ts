import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ApiErrorCode, REQUEST_LOGS_QUERY_CAP } from '@cabin/api-contract';
import { dateToLokiNs, lokiBaseUrl } from '../../common/http/loki-url.js';

const LOKI_QUERY_TIMEOUT_MS = 8_000;

export type LokiStreamValue = [nsTs: string, line: string];

type LokiQueryRangeResponse = {
  status?: string;
  data?: {
    resultType?: string;
    result?: Array<{
      values?: unknown[][];
    }>;
  };
};

export type LokiQueryRangeInput = {
  query: string;
  startNs: string;
  endNs: string;
  limit: number;
};

export { dateToLokiNs };

/** Loki documents ns timestamps as strings; coerce numbers so rows are not dropped. */
export function asLokiNsTs(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value)).toString();
  }
  return null;
}

export function asLokiLine(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

@Injectable()
export class LokiQueryClient {
  async queryRange(input: LokiQueryRangeInput): Promise<LokiStreamValue[]> {
    const url = new URL(`${lokiBaseUrl()}/loki/api/v1/query_range`);
    url.searchParams.set('query', input.query);
    url.searchParams.set('start', input.startNs);
    url.searchParams.set('end', input.endNs);
    url.searchParams.set('limit', String(input.limit));
    url.searchParams.set('direction', 'BACKWARD');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(LOKI_QUERY_TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableException({
        message: 'Request log store is unavailable.',
        code: ApiErrorCode.LOGS_UNAVAILABLE,
      });
    }

    if (!response.ok) {
      throw new ServiceUnavailableException({
        message: 'Request log store is unavailable.',
        code: ApiErrorCode.LOGS_UNAVAILABLE,
      });
    }

    let body: LokiQueryRangeResponse;
    try {
      body = (await response.json()) as LokiQueryRangeResponse;
    } catch {
      throw new ServiceUnavailableException({
        message: 'Request log store is unavailable.',
        code: ApiErrorCode.LOGS_UNAVAILABLE,
      });
    }

    const streams = body.data?.result ?? [];
    const values: LokiStreamValue[] = [];
    for (const stream of streams) {
      const rows = stream.values ?? [];
      for (const row of rows) {
        if (!Array.isArray(row)) {
          continue;
        }
        const nsTs = asLokiNsTs(row[0]);
        const line = asLokiLine(row[1]);
        if (nsTs && line !== null) {
          values.push([nsTs, line]);
        }
      }
    }

    return values.slice(0, REQUEST_LOGS_QUERY_CAP);
  }
}
