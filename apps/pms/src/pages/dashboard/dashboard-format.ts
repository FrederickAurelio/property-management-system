import type { StaffDashboardAttentionKind } from "@cabin/api-contract";
import type { ReservationBoard } from "@/lib/api";
import i18n from "@/i18n";

/** Primary why label for Needs — one chip max (no badge soup). */
export function primaryAttentionLabel(
  kinds: StaffDashboardAttentionKind[] | undefined,
  moneyKind: "due" | "refund" | "settled" | "closed",
): { label: string; tone: "default" | "muted" | "warn" | "danger" } | null {
  if (!kinds?.length) return null;

  if (kinds.includes("STRANDED_CONFIRMED")) {
    return {
      label: i18n.t("dashboard:attention.cancelNoShow"),
      tone: "danger",
    };
  }
  if (kinds.includes("ICAL")) {
    return { label: i18n.t("dashboard:attention.otaIssue"), tone: "warn" };
  }
  if (kinds.includes("NEEDS_DETAILS")) {
    return { label: i18n.t("dashboard:attention.needsDetails"), tone: "muted" };
  }
  if (kinds.includes("OPEN_BALANCE")) {
    if (moneyKind === "refund") {
      return { label: i18n.t("dashboard:attention.refund"), tone: "warn" };
    }
    // Due > 0, or DEPOSIT/UNPAID open-balance with no amount gap yet
    return { label: i18n.t("dashboard:attention.due"), tone: "default" };
  }
  return null;
}

/**
 * Pick View all board from Needs items' attention kinds.
 * Money-dominant → balance-due; stubs → needs-details; iCal → ical-alerts;
 * stranded / mixed → all (no board preset).
 */
export function dominantNeedsBoard(
  kinds: StaffDashboardAttentionKind[],
): ReservationBoard {
  if (kinds.length === 0) return "all";

  const counts: Record<StaffDashboardAttentionKind, number> = {
    OPEN_BALANCE: 0,
    STRANDED_CONFIRMED: 0,
    NEEDS_DETAILS: 0,
    ICAL: 0,
  };
  for (const k of kinds) {
    counts[k] += 1;
  }

  let best: StaffDashboardAttentionKind = "OPEN_BALANCE";
  let bestCount = -1;
  for (const key of Object.keys(counts) as StaffDashboardAttentionKind[]) {
    if (counts[key] > bestCount) {
      best = key;
      bestCount = counts[key];
    }
  }

  const winners = (Object.keys(counts) as StaffDashboardAttentionKind[]).filter(
    (k) => counts[k] === bestCount,
  );
  if (winners.length > 1 || best === "STRANDED_CONFIRMED") {
    return "all";
  }

  if (best === "OPEN_BALANCE") return "balance-due";
  if (best === "NEEDS_DETAILS") return "needs-details";
  if (best === "ICAL") return "ical-alerts";
  return "all";
}

export function reservationsBoardHref(
  board: ReservationBoard | null,
  propertyId: string,
): string {
  const params = new URLSearchParams();
  if (board && board !== "all") {
    params.set("board", board);
  }
  if (propertyId) {
    params.set("propertyId", propertyId);
  }
  const q = params.toString();
  return q ? `/reservations?${q}` : "/reservations";
}

/** Medium weekday date for page subtitle. */
export function formatDashboardTodayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}
