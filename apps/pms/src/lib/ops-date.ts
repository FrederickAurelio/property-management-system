/**
 * PMS date/timezone rules:
 *
 * 1. Stay YMD (`checkInDate`, blocks): never apply timezone; compare as strings.
 * 2. Ops "today" on property-scoped screens: `opsTodayYmd(property.timezone)`.
 * 3. YMD arithmetic (`addDaysYmd`, night counts): `@cabin/api-contract` UTC helpers.
 * 4. Picker bridge (`ymdToDate` / `dateToYmd`): local calendar `Date` for react-day-picker only.
 * 5. Property-scoped `<Calendar>`: set `today` + `timeZone` via `calendarOpsProps` — not browser default.
 * 6. Instant display (`createdAt`): property timezone on reservation detail; YMD labels stay locale-only.
 */
import {
  DEFAULT_PROPERTY_TIMEZONE,
  addDaysYmd,
  todayYmdInTimezone,
} from "@cabin/api-contract";

export { DEFAULT_PROPERTY_TIMEZONE, addDaysYmd, todayYmdInTimezone };

/** YMD string for property ops today. */
export function opsTodayYmd(
  timezone?: string | null,
  now = new Date(),
): string {
  const tz = timezone?.trim() || DEFAULT_PROPERTY_TIMEZONE;
  return todayYmdInTimezone(tz, now);
}

/** `Date` for react-day-picker `today` (calendar day = ops today YMD). */
export function opsTodayDate(timezone?: string | null, now = new Date()): Date {
  return ymdToDate(opsTodayYmd(timezone, now))!;
}

/** Props bundle for property-scoped `<Calendar>`. */
export function calendarOpsProps(timezone?: string | null) {
  const tz = timezone?.trim() || DEFAULT_PROPERTY_TIMEZONE;
  return { timeZone: tz, today: opsTodayDate(tz) };
}

export function resolvePropertyTimezone(
  properties: { id: string; timezone: string }[],
  propertyId: string,
): string {
  return (
    properties.find((p) => p.id === propertyId)?.timezone ??
    DEFAULT_PROPERTY_TIMEZONE
  );
}

/** Wire YMD → local calendar `Date` for react-day-picker (not an instant). */
export function ymdToDate(ymd: string): Date | undefined {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Local calendar `Date` → wire YMD. */
export function dateToYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
