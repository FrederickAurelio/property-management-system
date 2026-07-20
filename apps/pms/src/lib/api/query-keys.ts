import type {
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  UnitStatus,
} from "@cabin/api-contract";

export const staffSessionQueryKey = ["staff", "session"] as const;
export const staffAdminsQueryKey = ["staff", "admins"] as const;

export type ReservationBoard =
  | "arrivals"
  | "in-house"
  | "departures"
  | "needs-details"
  | "ical-alerts"
  | "balance-due"
  | "all";

/** Prefix — use with `invalidateQueries` to refresh all reservation lists. */
export const staffReservationsQueryKeyPrefix = ["staff", "reservations"] as const;

export type StaffReservationsListFilters = {
  propertyId?: string;
  q?: string;
  status?: ReservationStatus;
  source?: ReservationSource;
  board?: ReservationBoard;
  checkInDate?: string;
  checkOutDate?: string;
  hasIcalWarning?: boolean;
  paymentStatusIn?: PaymentStatus[];
  occupyingOnly?: boolean;
};

export function staffReservationsQueryKey(
  filters: StaffReservationsListFilters = {},
) {
  return [...staffReservationsQueryKeyPrefix, "list", filters] as const;
}

export function staffReservationQueryKey(id: string) {
  return [...staffReservationsQueryKeyPrefix, "detail", id] as const;
}

/** Prefix — use with `invalidateQueries` to refresh all property lists. */
export const staffPropertiesQueryKeyPrefix = ["staff", "properties"] as const;

export type StaffPropertiesListFilters = {
  q?: string;
  isActive?: boolean;
};

export function staffPropertiesQueryKey(filters: StaffPropertiesListFilters = {}) {
  return [...staffPropertiesQueryKeyPrefix, "list", filters] as const;
}

/**
 * Lightweight property options (id/name) — not infinite-list `Paginated` pages.
 * Do not reuse `staffPropertiesQueryKey` here; that key stores `InfiniteData`.
 */
export function staffPropertiesOptionsQueryKey() {
  return [...staffPropertiesQueryKeyPrefix, "options"] as const;
}

export function staffPropertyQueryKey(id: string) {
  return [...staffPropertiesQueryKeyPrefix, "detail", id] as const;
}

export const staffUnitTypesQueryKeyPrefix = ["staff", "unit-types"] as const;

export type StaffUnitTypesListFilters = {
  q?: string;
  isActive?: boolean;
};

export function staffUnitTypesQueryKey(
  propertyId: string,
  filters: StaffUnitTypesListFilters = {},
) {
  return [
    ...staffUnitTypesQueryKeyPrefix,
    "list",
    propertyId,
    filters,
  ] as const;
}

export function staffUnitTypeQueryKey(id: string) {
  return [...staffUnitTypesQueryKeyPrefix, "detail", id] as const;
}

export const staffUnitsQueryKeyPrefix = ["staff", "units"] as const;

export type StaffUnitsListFilters = {
  q?: string;
  unitTypeId?: string;
  status?: UnitStatus;
  isActive?: boolean;
};

export function staffUnitsQueryKey(
  propertyId: string,
  filters: StaffUnitsListFilters = {},
) {
  return [...staffUnitsQueryKeyPrefix, "list", propertyId, filters] as const;
}

export function staffUnitQueryKey(id: string) {
  return [...staffUnitsQueryKeyPrefix, "detail", id] as const;
}
