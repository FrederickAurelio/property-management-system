import type { ReservationBoard } from "@/lib/api";

export const RESERVATION_BOARDS: {
  id: ReservationBoard;
  label: string;
}[] = [
  { id: "arrivals", label: "Arrivals" },
  { id: "in-house", label: "In-house" },
  { id: "departures", label: "Departures" },
  { id: "needs-details", label: "Needs details" },
  { id: "ical-alerts", label: "iCal alerts" },
  { id: "balance-due", label: "Balance due" },
  { id: "all", label: "All" },
];

export function parseBoard(raw: string | null): ReservationBoard {
  const hit = RESERVATION_BOARDS.find((b) => b.id === raw);
  return hit?.id ?? "arrivals";
}

/**
 * Must match Nest `buildListWhere` board presets.
 * If the board owns a field, FE must not show or send that filter.
 */
export type BoardFilterLocks = {
  /** Board forces status (or a fixed status set). */
  locksStatus: boolean;
};

export function boardFilterLocks(board: ReservationBoard): BoardFilterLocks {
  switch (board) {
    case "arrivals":
    case "in-house":
    case "departures":
    case "needs-details":
    case "balance-due":
      return { locksStatus: true };
    case "ical-alerts":
    case "all":
      return { locksStatus: false };
  }
}
