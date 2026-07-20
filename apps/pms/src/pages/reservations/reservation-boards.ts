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
