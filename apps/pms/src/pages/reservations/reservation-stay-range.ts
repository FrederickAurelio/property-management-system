import { format } from "date-fns";
import {
  dateToYmd,
  todayYmdLocal,
  ymdToDate,
} from "@/pages/reports/reports-period";

export { dateToYmd, todayYmdLocal, ymdToDate };

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valid stay-touch from URL (`to` optional), or null. */
export function parseStayTouchRange(
  from: string | null,
  to: string | null,
): { from: string; to: string | null } | null {
  if (!from || !YMD_RE.test(from)) {
    return null;
  }
  if (to) {
    if (!YMD_RE.test(to) || from > to) {
      return null;
    }
    return { from, to };
  }
  return { from, to: null };
}

function addDaysLocalYmd(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + days);
  return dateToYmd(d);
}

/** Monday–Sunday of the week containing today (local). */
export function thisWeekInclusive(today = todayYmdLocal()): {
  from: string;
  to: string;
} {
  const d = ymdToDate(today)!;
  const day = d.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const from = addDaysLocalYmd(today, mondayOffset);
  const to = addDaysLocalYmd(from, 6);
  return { from, to };
}

/** 1st → last day of the current calendar month. */
export function thisMonthInclusive(today = todayYmdLocal()): {
  from: string;
  to: string;
} {
  const [y, m] = today.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y!, m!, 0);
  return { from, to: dateToYmd(last) };
}

/** Today → today + 29 days (30 inclusive days). */
export function next30DaysInclusive(today = todayYmdLocal()): {
  from: string;
  to: string;
} {
  return { from: today, to: addDaysLocalYmd(today, 29) };
}

export type StayRangePresetId = "this-week" | "this-month" | "next-30";

export const STAY_RANGE_PRESETS: { id: StayRangePresetId }[] = [
  { id: "this-week" },
  { id: "this-month" },
  { id: "next-30" },
];

export function rangeForStayPreset(
  id: StayRangePresetId,
  today = todayYmdLocal(),
): { from: string; to: string } {
  switch (id) {
    case "this-week":
      return thisWeekInclusive(today);
    case "this-month":
      return thisMonthInclusive(today);
    case "next-30":
      return next30DaysInclusive(today);
  }
}

export function activeStayPresetId(
  from: string,
  to: string,
  today = todayYmdLocal(),
): StayRangePresetId | null {
  for (const p of STAY_RANGE_PRESETS) {
    const r = rangeForStayPreset(p.id, today);
    if (r.from === from && r.to === to) return p.id;
  }
  return null;
}

/** Compact trigger label: same year → omit year on start; else full. */
export function formatStayTouchTriggerLabel(from: string, to: string): string {
  const a = ymdToDate(from);
  const b = ymdToDate(to);
  if (!a || !b) return `${from} – ${to}`;
  if (a.getFullYear() === b.getFullYear()) {
    return `${format(a, "d MMM")} – ${format(b, "d MMM yyyy")}`;
  }
  return `${format(a, "d MMM yyyy")} – ${format(b, "d MMM yyyy")}`;
}

/** Open-ended chip date fragment — i18n wraps as `{{date}} → All`. */
export function formatStayTouchFromDate(from: string): string {
  const a = ymdToDate(from);
  if (!a) return from;
  return format(a, "d MMM yyyy");
}
