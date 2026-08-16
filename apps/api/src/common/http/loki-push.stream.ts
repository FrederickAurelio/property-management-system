import { Writable } from 'node:stream';
import { dateToLokiNs, lokiBaseUrl } from './loki-url.js';

const PUSH_TIMEOUT_MS = 2_000;
const DEFAULT_FLUSH_MS = 75;
const MAX_BATCH = 50;

export type LokiPushStreamOptions = {
  post?: typeof fetch;
  now?: () => number;
  flushMs?: number;
  onPushError?: (reason: string) => void;
};

type LokiPushBatch = Array<[nsTs: string, line: string]>;

function isPinoHttpLine(line: string): boolean {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }
    const rec = parsed as { req?: unknown; res?: unknown };
    return (
      typeof rec.req === 'object' &&
      rec.req !== null &&
      typeof rec.res === 'object' &&
      rec.res !== null
    );
  } catch {
    return false;
  }
}

function nsFromPinoLine(line: string, nowMs: number): string {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed === 'object' && parsed !== null) {
      const time = (parsed as { time?: unknown }).time;
      if (typeof time === 'number' && Number.isFinite(time)) {
        return dateToLokiNs(new Date(time));
      }
    }
  } catch {
    // use wall clock
  }
  return dateToLokiNs(new Date(nowMs));
}

async function postBatch(
  batch: LokiPushBatch,
  post: typeof fetch,
): Promise<void> {
  if (batch.length === 0) {
    return;
  }
  const url = `${lokiBaseUrl()}/loki/api/v1/push`;
  const response = await post(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      streams: [
        {
          stream: { service: 'api' },
          values: batch,
        },
      ],
    }),
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Loki push HTTP ${response.status}`);
  }
}

/** Fire-and-forget NDJSON → Loki push. Never blocks the Nest request. */
export function createLokiPushStream(
  options: LokiPushStreamOptions = {},
): Writable {
  const post = options.post ?? fetch;
  const now = options.now ?? Date.now;
  const flushMs = options.flushMs ?? DEFAULT_FLUSH_MS;
  const onPushError =
    options.onPushError ??
    ((reason: string) => {
      console.warn(`[loki-push] ${reason}`);
    });

  let pending: LokiPushBatch = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    const batch = pending;
    pending = [];
    if (batch.length === 0) {
      return;
    }
    void postBatch(batch, post).catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : 'Loki push failed';
      onPushError(reason);
    });
  };

  const enqueue = (line: string): void => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || !isPinoHttpLine(trimmed)) {
      return;
    }
    pending.push([nsFromPinoLine(trimmed, now()), trimmed]);
    if (pending.length >= MAX_BATCH) {
      flush();
      return;
    }
    if (!timer) {
      timer = setTimeout(flush, flushMs);
      timer.unref?.();
    }
  };

  return new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      for (const line of text.split('\n')) {
        enqueue(line);
      }
      callback();
    },
    final(callback) {
      flush();
      callback();
    },
  });
}
