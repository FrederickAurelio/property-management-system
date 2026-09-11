import { createHash, timingSafeEqual } from 'node:crypto';

/** Same length as `newIcalExportToken()` (24 bytes hex). */
const TOKEN_COMPARE_DUMMY = '0'.repeat(48);

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Constant-time compare of the query token against the stored export token.
 * Always hashes both sides so missing unit vs wrong token stay indistinguishable.
 */
export function icalExportTokenMatches(
  provided: string,
  stored: string | undefined,
): boolean {
  const expected = stored && stored.length > 0 ? stored : TOKEN_COMPARE_DUMMY;
  const equal = timingSafeEqual(sha256(provided), sha256(expected));
  return Boolean(stored && stored.length > 0 && equal);
}
