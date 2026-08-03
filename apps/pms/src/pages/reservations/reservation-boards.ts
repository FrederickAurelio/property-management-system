import i18n from "@/i18n";
import type { ReservationBoard } from "@/lib/api";

export const RESERVATION_BOARD_IDS: ReservationBoard[] = [
  "arrivals",
  "in-house",
  "departures",
  "needs-details",
  "ical-alerts",
  "balance-due",
  "all",
];

export function reservationBoardLabel(id: ReservationBoard): string {
  switch (id) {
    case "arrivals":
      return i18n.t("reservations:boards.arrivals");
    case "in-house":
      return i18n.t("reservations:boards.inHouse");
    case "departures":
      return i18n.t("reservations:boards.departures");
    case "needs-details":
      return i18n.t("reservations:boards.needsDetails");
    case "ical-alerts":
      return i18n.t("reservations:boards.icalAlerts");
    case "balance-due":
      return i18n.t("reservations:boards.balanceDue");
    case "all":
      return i18n.t("reservations:boards.all");
  }
}

export function reservationBoards(): { id: ReservationBoard; label: string }[] {
  return RESERVATION_BOARD_IDS.map((id) => ({
    id,
    label: reservationBoardLabel(id),
  }));
}

export function parseBoard(raw: string | null): ReservationBoard {
  const hit = RESERVATION_BOARD_IDS.find((b) => b === raw);
  return hit ?? "arrivals";
}

/**
 * Must match Nest `buildListWhere` board presets.
 * If the board owns a field, FE must not show or send that filter.
 */
export type BoardFilterLocks = {
  /** Board forces status (or a fixed status set). */
  locksStatus: boolean;
  /**
   * Stay-touch `from`/`to` — lookup boards only.
   * Hidden on Arrivals / Departures (those already mean today).
   */
  showDateRangeFilter: boolean;
};

export function boardFilterLocks(board: ReservationBoard): BoardFilterLocks {
  switch (board) {
    case "arrivals":
    case "departures":
      return { locksStatus: true, showDateRangeFilter: false };
    case "in-house":
    case "needs-details":
    case "balance-due":
      return { locksStatus: true, showDateRangeFilter: true };
    case "ical-alerts":
    case "all":
      return { locksStatus: false, showDateRangeFilter: true };
  }
}
