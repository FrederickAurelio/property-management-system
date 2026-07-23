/**
 * Preserve return context when opening a reservation detail
 * from boards list, calendar, or dashboard.
 */
export type ReservationReturnLocationState = {
  /** `location.search` from `/reservations` (includes leading `?` or empty). */
  listSearch?: string;
  /** `location.search` from `/calendar` (includes leading `?` or empty). */
  calendarSearch?: string;
  /** `location.search` from `/` dashboard (includes leading `?` or empty). */
  dashboardSearch?: string;
};

/** @deprecated Use ReservationReturnLocationState */
export type ReservationListLocationState = ReservationReturnLocationState;

export function isReservationReturnLocationState(
  value: unknown,
): value is ReservationReturnLocationState {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const state = value as ReservationReturnLocationState;
  const listOk =
    state.listSearch === undefined || typeof state.listSearch === "string";
  const calOk =
    state.calendarSearch === undefined ||
    typeof state.calendarSearch === "string";
  const dashOk =
    state.dashboardSearch === undefined ||
    typeof state.dashboardSearch === "string";
  return listOk && calOk && dashOk;
}

/** @deprecated Use isReservationReturnLocationState */
export const isReservationListLocationState = isReservationReturnLocationState;

function withSearch(path: string, raw: string | undefined): string {
  if (!raw || raw === "" || raw === "?") {
    return path;
  }
  return raw.startsWith("?") ? `${path}${raw}` : `${path}?${raw}`;
}

/**
 * Back href priority: calendar → dashboard → reservations list.
 */
export function reservationDetailBackHref(state: unknown): string {
  if (!isReservationReturnLocationState(state)) {
    return "/reservations";
  }
  if (state.calendarSearch !== undefined) {
    return withSearch("/calendar", state.calendarSearch);
  }
  if (state.dashboardSearch !== undefined) {
    return withSearch("/", state.dashboardSearch);
  }
  return withSearch("/reservations", state.listSearch);
}

/** @deprecated Use reservationDetailBackHref */
export function reservationsListHref(state: unknown): string {
  return reservationDetailBackHref(state);
}

export function reservationListStateFromSearch(
  search: string,
): ReservationReturnLocationState {
  return { listSearch: search };
}

export function reservationCalendarStateFromSearch(
  search: string,
): ReservationReturnLocationState {
  return { calendarSearch: search };
}

export function reservationDashboardStateFromSearch(
  search: string,
): ReservationReturnLocationState {
  return { dashboardSearch: search };
}
