import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export const ICS_BODY_MAX_BYTES = 2 * 1024 * 1024;
export const ICS_MAX_REDIRECTS = 3;
export const UNSAFE_ICAL_IMPORT_URL_MESSAGE = 'Import URL is not allowed';

export class UnsafeIcalImportUrlError extends Error {
  constructor(message = UNSAFE_ICAL_IMPORT_URL_MESSAGE) {
    super(message);
    this.name = 'UnsafeIcalImportUrlError';
  }
}

export type IcalDnsLookup = (
  hostname: string,
) => Promise<ReadonlyArray<{ address: string; family: number }>>;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.internal',
]);

const privateNets = (() => {
  const list = new BlockList();
  list.addSubnet('0.0.0.0', 8, 'ipv4');
  list.addAddress('255.255.255.255', 'ipv4');
  list.addSubnet('10.0.0.0', 8, 'ipv4');
  list.addSubnet('127.0.0.0', 8, 'ipv4');
  list.addSubnet('169.254.0.0', 16, 'ipv4');
  list.addSubnet('172.16.0.0', 12, 'ipv4');
  list.addSubnet('192.168.0.0', 16, 'ipv4');
  list.addSubnet('100.64.0.0', 10, 'ipv4');
  list.addAddress('::', 'ipv6');
  list.addAddress('::1', 'ipv6');
  list.addSubnet('fc00::', 7, 'ipv6');
  list.addSubnet('fe80::', 10, 'ipv6');
  return list;
})();

function headerGet(
  res: { headers?: { get?: (name: string) => string | null } },
  name: string,
): string | null {
  const get = res.headers?.get;
  if (typeof get !== 'function') {
    return null;
  }
  return get.call(res.headers, name);
}

function normalizeHostname(hostname: string): string {
  const withoutBrackets =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  return withoutBrackets.replace(/\.+$/, '').toLowerCase();
}

function ipv4MappedToV4(address: string): string | null {
  const lower = address.toLowerCase();
  if (!lower.startsWith('::ffff:')) {
    return null;
  }
  const embedded = address.slice('::ffff:'.length);
  return isIP(embedded) === 4 ? embedded : null;
}

export function isBlockedIpAddress(address: string, family: number): boolean {
  const mapped = ipv4MappedToV4(address);
  if (mapped) {
    return privateNets.check(mapped, 'ipv4');
  }
  if (family === 6 || isIP(address) === 6) {
    return privateNets.check(address, 'ipv6');
  }
  if (family === 4 || isIP(address) === 4) {
    return privateNets.check(address, 'ipv4');
  }
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }
  return host.endsWith('.localhost') || host.endsWith('.local');
}

async function defaultDnsLookup(
  hostname: string,
): Promise<ReadonlyArray<{ address: string; family: number }>> {
  return dnsLookup(hostname, { all: true });
}

/**
 * Sync checks: scheme, credentials, literal IPs, metadata/loopback names.
 * Does not resolve DNS — that belongs at fetch time (rebinding).
 */
export function assertIcalImportUrlShape(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new UnsafeIcalImportUrlError();
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UnsafeIcalImportUrlError();
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new UnsafeIcalImportUrlError();
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeIcalImportUrlError();
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isBlockedHostname(hostname)) {
    throw new UnsafeIcalImportUrlError();
  }

  const ipVersion = isIP(hostname);
  if (ipVersion !== 0 && isBlockedIpAddress(hostname, ipVersion)) {
    throw new UnsafeIcalImportUrlError();
  }

  return parsed;
}

async function assertResolvedAddressesPublic(
  hostname: string,
  lookupFn: IcalDnsLookup,
): Promise<void> {
  let records: ReadonlyArray<{ address: string; family: number }>;
  try {
    records = await lookupFn(hostname);
  } catch {
    throw new Error('Could not resolve import URL host');
  }
  if (records.length === 0) {
    throw new Error('Could not resolve import URL host');
  }
  for (const record of records) {
    if (isBlockedIpAddress(record.address, record.family)) {
      throw new UnsafeIcalImportUrlError();
    }
  }
}

/** Shape + DNS: every resolved address must be public. */
export async function assertSafeIcalImportUrl(
  raw: string,
  lookupFn: IcalDnsLookup = defaultDnsLookup,
): Promise<URL> {
  const parsed = assertIcalImportUrlShape(raw);
  const hostname = normalizeHostname(parsed.hostname);
  if (isIP(hostname) !== 0) {
    return parsed;
  }
  await assertResolvedAddressesPublic(hostname, lookupFn);
  return parsed;
}

function responseStatus(res: { ok: boolean; status?: number }): number {
  if (typeof res.status === 'number') {
    return res.status;
  }
  return res.ok ? 200 : 0;
}

function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

async function readCappedBody(
  res: Response,
  maxBytes: number,
): Promise<string> {
  const rawLen = headerGet(res, 'content-length');
  if (rawLen) {
    const n = Number(rawLen);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new Error('Feed exceeds size limit');
    }
  }

  const stream = res.body;
  if (stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Feed exceeds size limit');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  const text = await res.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new Error('Feed exceeds size limit');
  }
  return text;
}

async function discardBody(res: Response): Promise<void> {
  try {
    if (res.body && typeof res.body.cancel === 'function') {
      await res.body.cancel();
      return;
    }
    await res.arrayBuffer();
  } catch {
    // Redirect hop — ignore incomplete mock bodies in tests.
  }
}

/**
 * Fetch an ICS body: public hosts only, no private-IP redirects, capped size.
 */
export async function fetchIcsText(
  importUrl: string,
  signal: AbortSignal,
  lookupFn: IcalDnsLookup = defaultDnsLookup,
): Promise<string> {
  let current = importUrl;
  for (let hop = 0; hop <= ICS_MAX_REDIRECTS; hop += 1) {
    await assertSafeIcalImportUrl(current, lookupFn);
    const res = await fetch(current, {
      signal,
      headers: { Accept: 'text/calendar, text/plain, */*' },
      redirect: 'manual',
    });
    const status = responseStatus(res);
    if (isRedirectStatus(status)) {
      const location = headerGet(res, 'location');
      await discardBody(res);
      if (!location?.trim()) {
        throw new Error('Feed redirect missing Location');
      }
      current = new URL(location, current).href;
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${status || res.status} fetching feed`);
    }
    return readCappedBody(res, ICS_BODY_MAX_BYTES);
  }
  throw new Error('Feed redirected too many times');
}
