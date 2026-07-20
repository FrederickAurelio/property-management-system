/** Preserve list board/filters when opening a reservation detail. */
export type ReservationListLocationState = {
  /** `location.search` from the list page (includes leading `?` or empty). */
  listSearch?: string;
};

export function isReservationListLocationState(
  value: unknown,
): value is ReservationListLocationState {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const search = (value as ReservationListLocationState).listSearch;
  return search === undefined || typeof search === "string";
}

/** Back href to `/reservations` with prior query string when available. */
export function reservationsListHref(state: unknown): string {
  if (!isReservationListLocationState(state) || !state.listSearch) {
    return "/reservations";
  }
  const raw = state.listSearch;
  if (raw === "" || raw === "?") {
    return "/reservations";
  }
  return raw.startsWith("?")
    ? `/reservations${raw}`
    : `/reservations?${raw}`;
}

export function reservationListStateFromSearch(
  search: string,
): ReservationListLocationState {
  return { listSearch: search };
}
