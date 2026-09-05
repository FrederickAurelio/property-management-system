/**
 * Inclusive calendar-day helpers for staff reports periods.
 * Cash uses property TZ → UTC half-open Instant ranges; stay nights use `@db.Date`.
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertYmd(ymd: string, label = 'date'): void {
  if (!YMD_RE.test(ymd)) {
    throw new Error(`Invalid ${label}: expected YYYY-MM-DD`);
  }
}

/** Add signed calendar days to a YYYY-MM-DD (UTC date arithmetic). */
export function addDaysYmd(ymd: string, days: number): string {
  assertYmd(ymd);
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Inclusive day count for [from, to]. */
export function inclusiveDayCount(from: string, to: string): number {
  assertYmd(from, 'from');
  assertYmd(to, 'to');
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy!, fm! - 1, fd!);
  const b = Date.UTC(ty!, tm! - 1, td!);
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** Previous equal-length inclusive period ending the day before `from`. */
export function previousEqualPeriod(
  from: string,
  to: string,
): { from: string; to: string } {
  const days = inclusiveDayCount(from, to);
  const prevTo = addDaysYmd(from, -1);
  const prevFrom = addDaysYmd(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

/**
 * Offset of `timeZone` at `date`: (wall-clock as if UTC) − actual UTC.
 * Used to find the Instant of local midnight.
 */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const v = parts.find((p) => p.type === type)?.value;
    return v == null ? 0 : Number(v);
  };
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - date.getTime();
}

/** UTC Instant for 00:00:00 on `ymd` in `timeZone`. */
export function zonedYmdStartUtc(ymd: string, timeZone: string): Date {
  assertYmd(ymd);
  const [y, mo, d] = ymd.split('-').map(Number) as [number, number, number];
  let utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const offsetMs = tzOffsetMs(new Date(utcMs), timeZone);
    utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - offsetMs;
  }
  return new Date(utcMs);
}

/**
 * Inclusive `[from, to]` calendar days in `timeZone` → UTC half-open Instant
 * range `[start, endExclusive)` for filtering `createdAt`.
 */
export function ymdInclusiveToUtcHalfOpen(
  from: string,
  toInclusive: string,
  timeZone: string,
): { start: Date; endExclusive: Date } {
  assertYmd(from, 'from');
  assertYmd(toInclusive, 'to');
  return {
    start: zonedYmdStartUtc(from, timeZone),
    endExclusive: zonedYmdStartUtc(addDaysYmd(toInclusive, 1), timeZone),
  };
}

/** Max inclusive span for staff reports summary (days). */
export const REPORTS_MAX_INCLUSIVE_DAYS = 366;

/** Occupancy statuses that count nights on reports (includes CHECKED_OUT). */
export const REPORTS_OCCUPANCY_STATUSES = [
  'UNCONFIRMED',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
] as const;

/**
 * Whether billed month `YYYY-MM` overlaps inclusive `[from, to]` YMDs.
 * July bill is included in any range that touches 1–31 July.
 */
export function yearMonthOverlapsInclusiveRange(
  chargeYearMonth: string,
  from: string,
  to: string,
): boolean {
  if (!/^\d{4}-\d{2}$/.test(chargeYearMonth)) {
    return false;
  }
  const monthStart = `${chargeYearMonth}-01`;
  const y = Number(chargeYearMonth.slice(0, 4));
  const m = Number(chargeYearMonth.slice(5, 7));
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextStart = `${String(nextY).padStart(4, '0')}-${String(nextM).padStart(2, '0')}-01`;
  const monthEnd = addDaysYmd(nextStart, -1);
  return monthStart <= to && monthEnd >= from;
}

/**
 * Rent accrued into an inclusive report window.
 * `floor(rent × clipNights / stayNights)`; 0 when any input is non-positive.
 */
export function accrueRentIdr(
  rentAmountIdr: number,
  stayNights: number,
  clipNights: number,
): number {
  if (rentAmountIdr <= 0 || stayNights <= 0 || clipNights <= 0) {
    return 0;
  }
  return Math.floor((rentAmountIdr * clipNights) / stayNights);
}
