const DEFAULT_LOKI_URL = 'http://127.0.0.1:3100';

export function lokiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.LOKI_URL?.trim();
  if (raw && raw.length > 0) {
    return raw.replace(/\/$/, '');
  }
  return DEFAULT_LOKI_URL;
}

export function dateToLokiNs(date: Date): string {
  return (BigInt(Math.trunc(date.getTime())) * 1_000_000n).toString();
}

/** Tests never push. Host Nest and `cabin-api` always ship HTTP JSON to Loki. */
export function shouldPushRequestLogsToLoki(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV !== 'test';
}
