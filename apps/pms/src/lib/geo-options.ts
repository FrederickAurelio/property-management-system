/**
 * Country + IANA timezone option lists for property forms.
 * Countries: ISO 3166-1 alpha-2 via `i18n-iso-countries` (en/id).
 * Timezones: `Intl.supportedValuesOf('timeZone')` with Indonesia zones pinned first.
 */
import countries from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";
import idCountries from "i18n-iso-countries/langs/id.json";

export type GeoOption = {
  value: string;
  label: string;
  /** Extra tokens for search (codes, IANA id, aliases). */
  searchText: string;
  group?: string;
};

let localesRegistered = false;

function ensureCountryLocales() {
  if (localesRegistered) return;
  countries.registerLocale(enCountries);
  countries.registerLocale(idCountries);
  localesRegistered = true;
}

/** Indonesia IANA zones — WIB / WITA / WIT (most common for this product). */
export const INDONESIA_TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
] as const;

const INDONESIA_TIMEZONE_LABEL: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

export function isValidIanaTimezone(timezone: string): boolean {
  const tz = timezone.trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidCountryCode(code: string): boolean {
  ensureCountryLocales();
  return countries.isValid(code.trim().toUpperCase());
}

export function countryName(
  code: string,
  locale: "en" | "id",
): string | undefined {
  ensureCountryLocales();
  return countries.getName(code.trim().toUpperCase(), locale);
}

function utcOffsetMinutes(timezone: string, at = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? 0);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

function formatUtcOffset(timezone: string, at = new Date()): string {
  const minutes = utcOffsetMinutes(timezone, at);
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

function timezoneLabel(timezone: string): string {
  const band = INDONESIA_TIMEZONE_LABEL[timezone];
  const offset = formatUtcOffset(timezone);
  if (band) {
    return `${timezone} (${band} · ${offset})`;
  }
  return `${timezone} (${offset})`;
}

function allSupportedTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  return [...INDONESIA_TIMEZONES];
}

export function getCountryOptions(locale: "en" | "id"): GeoOption[] {
  ensureCountryLocales();
  const names = countries.getNames(locale, { select: "official" });
  const options = Object.entries(names).map(([code, name]) => ({
    value: code,
    label: `${name} (${code})`,
    searchText: `${code} ${name}`.toLowerCase(),
    group: code === "ID" ? "priority" : undefined,
  }));
  options.sort((a, b) => {
    if (a.value === "ID") return -1;
    if (b.value === "ID") return 1;
    return a.label.localeCompare(b.label, locale);
  });
  return options;
}

export function getTimezoneOptions(
  locale: "en" | "id",
  extraValues: string[] = [],
): GeoOption[] {
  const supported = new Set(allSupportedTimezones());
  const ordered: string[] = [];

  for (const tz of INDONESIA_TIMEZONES) {
    if (supported.has(tz)) ordered.push(tz);
  }

  const rest = [...supported]
    .filter(
      (tz) =>
        !INDONESIA_TIMEZONES.includes(
          tz as (typeof INDONESIA_TIMEZONES)[number],
        ),
    )
    .sort((a, b) => {
      const off = utcOffsetMinutes(a) - utcOffsetMinutes(b);
      if (off !== 0) return off;
      return a.localeCompare(b, locale);
    });

  ordered.push(...rest);

  for (const tz of extraValues) {
    const trimmed = tz.trim();
    if (trimmed && !ordered.includes(trimmed)) {
      ordered.unshift(trimmed);
    }
  }

  return ordered.map((tz) => {
    const isId = INDONESIA_TIMEZONES.includes(
      tz as (typeof INDONESIA_TIMEZONES)[number],
    );
    return {
      value: tz,
      label: timezoneLabel(tz),
      searchText:
        `${tz} ${INDONESIA_TIMEZONE_LABEL[tz] ?? ""} ${formatUtcOffset(tz)}`.toLowerCase(),
      group: isId ? "indonesia" : undefined,
    };
  });
}
