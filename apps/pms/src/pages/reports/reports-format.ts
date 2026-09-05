import {
  ReservationSource,
  type StaffReportsCash,
  type StaffReportsCashSourceRow,
  type StaffReportsSourceMixRow,
} from "@cabin/api-contract";
import { formatIdr } from "@/pages/properties/inventory-types";
import { cn } from "@/lib/utils";
import i18n from "@/i18n";

export { inclusiveDayCount } from "@cabin/api-contract";

export function formatPct(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) {
    return i18n.t("reports:format.notAvailable");
  }
  return `${pct}%`;
}

export function formatSignedIdr(amount: number): string {
  const abs = formatIdr(Math.abs(amount));
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `−${abs}`;
  return formatIdr(0);
}

export function formatSignedPts(delta: number | null | undefined): string {
  if (delta == null) return "—";
  if (delta > 0) {
    return i18n.t("reports:format.pointsPositive", { count: delta });
  }
  if (delta < 0) {
    return i18n.t("reports:format.pointsNegative", { count: delta });
  }
  return i18n.t("reports:format.pointsZero");
}

export function formatSignedNights(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return "0";
}

/** Percentage-point share delta (current % − previous %). */
export function shareDeltaPp(
  currentPct: number,
  previousPct: number | undefined,
): number | null {
  if (previousPct == null) return null;
  return Math.round((currentPct - previousPct) * 10) / 10;
}

export function pctOfTotal(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** Guest Collect − guest refunds. Expense Out is excluded so source shares still add up. */
export function guestLedgerNetIdr(
  cash: Pick<StaffReportsCash, "guestInIdr" | "guestOutIdr">,
): number {
  return cash.guestInIdr - cash.guestOutIdr;
}

const DIRECT_SOURCES: readonly ReservationSource[] = [
  ReservationSource.MANUAL,
  ReservationSource.WEBSITE,
];

const OTA_SOURCES: readonly ReservationSource[] = [
  ReservationSource.BOOKING_COM,
  ReservationSource.AIRBNB,
  ReservationSource.AGODA,
];

export type DirectVsOtaRollup = {
  directNights: number;
  otaNights: number;
  directNightsPct: number;
  otaNightsPct: number;
  directCashNetIdr: number;
  otaCashNetIdr: number;
  directCashNetPct: number;
  otaCashNetPct: number;
};

export function directVsOta(
  sourceMix: StaffReportsSourceMixRow[],
  cashBySource: StaffReportsCashSourceRow[],
  periodCashNet: number,
): DirectVsOtaRollup {
  const totalNights = sourceMix.reduce((s, r) => s + r.nights, 0);
  const cashMap = new Map(cashBySource.map((r) => [r.source, r.netIdr]));

  let directNights = 0;
  let otaNights = 0;
  let directCashNetIdr = 0;
  let otaCashNetIdr = 0;

  for (const row of sourceMix) {
    const cashNet = cashMap.get(row.source) ?? 0;
    if ((DIRECT_SOURCES as readonly string[]).includes(row.source)) {
      directNights += row.nights;
      directCashNetIdr += cashNet;
    } else if ((OTA_SOURCES as readonly string[]).includes(row.source)) {
      otaNights += row.nights;
      otaCashNetIdr += cashNet;
    }
  }

  return {
    directNights,
    otaNights,
    directNightsPct: pctOfTotal(directNights, totalNights),
    otaNightsPct: pctOfTotal(otaNights, totalNights),
    directCashNetIdr,
    otaCashNetIdr,
    directCashNetPct: pctOfTotal(
      directCashNetIdr,
      Math.abs(periodCashNet) || 0,
    ),
    otaCashNetPct: pctOfTotal(otaCashNetIdr, Math.abs(periodCashNet) || 0),
  };
}

export function deltaToneClass(amount: number): string {
  return cn(
    "tabular-nums",
    amount > 0 && "text-emerald-700 dark:text-emerald-400",
    amount < 0 && "text-destructive",
    amount === 0 && "text-muted-foreground",
  );
}
