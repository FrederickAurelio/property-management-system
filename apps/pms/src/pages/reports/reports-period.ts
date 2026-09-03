import { format } from "date-fns";
import {
  addDaysYmd,
  inclusiveDayCount,
  previousEqualPeriod,
} from "@cabin/api-contract";
import i18n from "@/i18n";
import { dateToYmd, ymdToDate } from "@/lib/ops-date";

export { inclusiveDayCount, previousEqualPeriod };
export { dateToYmd, ymdToDate };

/** Month-to-date: 1st of current month → today (inclusive). */
export function defaultMonthToDate(today: string): {
  from: string;
  to: string;
} {
  const [y, m] = today.split("-");
  return { from: `${y}-${m}-01`, to: today };
}

/** Full previous calendar month (inclusive). */
export function lastFullMonth(today: string): {
  from: string;
  to: string;
} {
  const [y, m] = today.split("-").map(Number);
  const firstThis = new Date(y!, m! - 1, 1);
  const lastPrev = new Date(firstThis);
  lastPrev.setDate(0);
  const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
  return { from: dateToYmd(firstPrev), to: dateToYmd(lastPrev) };
}

/** Inclusive last N days ending today. */
export function lastNDaysInclusive(
  n: number,
  today: string,
): { from: string; to: string } {
  return { from: addDaysYmd(today, -(n - 1)), to: today };
}

export type ReportsPeriodPresetId = "mtd" | "last-month" | "last-7" | "last-30";

export const REPORTS_PERIOD_PRESETS: { id: ReportsPeriodPresetId }[] = [
  { id: "mtd" },
  { id: "last-month" },
  { id: "last-7" },
  { id: "last-30" },
];

const PRESET_LABEL_KEY: Record<ReportsPeriodPresetId, string> = {
  mtd: "mtd",
  "last-month": "lastMonth",
  "last-7": "last7",
  "last-30": "last30",
};

export function reportsPeriodPresetLabel(id: ReportsPeriodPresetId): string {
  return i18n.t(`reports:filterBar.presets.${PRESET_LABEL_KEY[id]}`);
}

export function rangeForPreset(
  id: ReportsPeriodPresetId,
  today: string,
): { from: string; to: string } {
  switch (id) {
    case "mtd":
      return defaultMonthToDate(today);
    case "last-month":
      return lastFullMonth(today);
    case "last-7":
      return lastNDaysInclusive(7, today);
    case "last-30":
      return lastNDaysInclusive(30, today);
  }
}

/** Which preset matches the current range (if any). */
export function activePresetId(
  from: string,
  to: string,
  today: string,
): ReportsPeriodPresetId | null {
  for (const p of REPORTS_PERIOD_PRESETS) {
    const r = rangeForPreset(p.id, today);
    if (r.from === from && r.to === to) return p.id;
  }
  return null;
}

export function formatInclusiveRangeLabel(from: string, to: string): string {
  const a = ymdToDate(from);
  const b = ymdToDate(to);
  if (!a || !b) return "—";
  return `${format(a, "LLL d, y")} – ${format(b, "LLL d, y")}`;
}

export function formatShortYmd(ymd: string): string {
  const d = ymdToDate(ymd);
  if (!d) return ymd;
  return format(d, "d MMM yyyy");
}

/** e.g. `23 days · vs 1 Jun – 23 Jun 2026` */
export function formatPeriodChrome(
  from: string,
  to: string,
  compareWindow: { from: string; to: string } | null,
): string {
  const days = inclusiveDayCount(from, to);
  const dayLabel = i18n.t("reports:filterBar.chromeDays", { count: days });
  if (!compareWindow) return dayLabel;
  const range = formatInclusiveRangeLabel(compareWindow.from, compareWindow.to);
  return `${dayLabel} · ${i18n.t("reports:filterBar.chromeVs", { range })}`;
}
