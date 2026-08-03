import type {
  PaymentStatus,
  ReservationListSort,
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
export const staffReservationsQueryKeyPrefix = [
  "staff",
  "reservations",
] as const;

/** List queries only — does not match detail keys (safe with `setQueryData` on detail). */
export const staffReservationsListQueryKeyPrefix = [
  ...staffReservationsQueryKeyPrefix,
  "list",
] as const;

export type StaffReservationsListFilters = {
  propertyId?: string;
  q?: string;
  status?: ReservationStatus;
  source?: ReservationSource;
  board?: ReservationBoard;
  sort?: ReservationListSort;
  checkInDate?: string;
  checkOutDate?: string;
  from?: string;
  to?: string;
  hasIcalWarning?: boolean;
  paymentStatusIn?: PaymentStatus[];
  occupyingOnly?: boolean;
};

export function staffReservationsQueryKey(
  filters: StaffReservationsListFilters = {},
) {
  return [...staffReservationsListQueryKeyPrefix, filters] as const;
}

export function staffReservationQueryKey(id: string) {
  return [...staffReservationsQueryKeyPrefix, "detail", id] as const;
}

/** Prefix — use with `invalidateQueries` to refresh all property lists. */
export const staffPropertiesQueryKeyPrefix = ["staff", "properties"] as const;

/** Infinite list queries only — safe with `setQueryData` on detail. */
export const staffPropertiesListQueryKeyPrefix = [
  ...staffPropertiesQueryKeyPrefix,
  "list",
] as const;

export type StaffPropertiesListFilters = {
  q?: string;
  isActive?: boolean;
};

export function staffPropertiesQueryKey(
  filters: StaffPropertiesListFilters = {},
) {
  return [...staffPropertiesListQueryKeyPrefix, filters] as const;
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

/** Infinite list queries only — safe with `setQueryData` on detail. */
export const staffUnitTypesListQueryKeyPrefix = [
  ...staffUnitTypesQueryKeyPrefix,
  "list",
] as const;

export type StaffUnitTypesListFilters = {
  q?: string;
  isActive?: boolean;
};

export function staffUnitTypesQueryKey(
  propertyId: string,
  filters: StaffUnitTypesListFilters = {},
) {
  return [...staffUnitTypesListQueryKeyPrefix, propertyId, filters] as const;
}

export function staffUnitTypeQueryKey(id: string) {
  return [...staffUnitTypesQueryKeyPrefix, "detail", id] as const;
}

export function staffUnitTypeRackQueryKey(id: string) {
  return [...staffUnitTypesQueryKeyPrefix, "rack", id] as const;
}

export const staffUnitsQueryKeyPrefix = ["staff", "units"] as const;

/** Infinite list queries only — does not match availability / occupancy / detail. */
export const staffUnitsListQueryKeyPrefix = [
  ...staffUnitsQueryKeyPrefix,
  "list",
] as const;

/** Choose-unit availability — invalidate when occupying nights may change. */
export const staffUnitsAvailabilityQueryKeyPrefix = [
  ...staffUnitsQueryKeyPrefix,
  "availability",
] as const;

/** Stay date-picker blocks — invalidate when occupying nights may change. */
export const staffUnitsOccupancyQueryKeyPrefix = [
  ...staffUnitsQueryKeyPrefix,
  "occupancy",
] as const;

export type StaffUnitsListFilters = {
  q?: string;
  unitTypeId?: string;
  status?: UnitStatus;
};

export function staffUnitsQueryKey(
  propertyId: string,
  filters: StaffUnitsListFilters = {},
) {
  return [...staffUnitsListQueryKeyPrefix, propertyId, filters] as const;
}

export function staffUnitsAvailabilityQueryKey(
  propertyId: string,
  filters: {
    checkInDate?: string;
    checkOutDate?: string;
    unitTypeId?: string;
    excludeReservationId?: string;
    excludeBlockId?: string;
  } = {},
) {
  return [
    ...staffUnitsAvailabilityQueryKeyPrefix,
    propertyId,
    filters,
  ] as const;
}

export function staffUnitOccupancyQueryKey(
  unitId: string,
  filters: {
    yearMonth: string;
    excludeReservationId?: string;
  },
) {
  return [...staffUnitsOccupancyQueryKeyPrefix, unitId, filters] as const;
}

export function staffUnitQueryKey(id: string) {
  return [...staffUnitsQueryKeyPrefix, "detail", id] as const;
}

/** Property calendar aggregate (unit × days). */
export const staffPropertyCalendarQueryKeyPrefix = [
  "staff",
  "properties",
  "calendar",
] as const;

export type StaffPropertyCalendarParams = {
  propertyId: string;
  from: string;
  to: string;
};

export function staffPropertyCalendarQueryKey(
  params: StaffPropertyCalendarParams,
) {
  return [
    ...staffPropertyCalendarQueryKeyPrefix,
    params.propertyId,
    params.from,
    params.to,
  ] as const;
}

/** Staff period reports summary (cash · occupancy · source · open balances). */
export const staffReportsQueryKeyPrefix = ["staff", "reports"] as const;

export type StaffReportsSummaryQueryParams = {
  propertyId: string;
  from: string;
  to: string;
  compare: boolean;
};

export function staffReportsSummaryQueryKey(
  params: StaffReportsSummaryQueryParams,
) {
  return [...staffReportsQueryKeyPrefix, "summary", params] as const;
}

/** Staff desk dashboard triage (today arrivals/departures + needs attention). */
export const staffDashboardQueryKeyPrefix = ["staff", "dashboard"] as const;

export type StaffDashboardQueryParams = {
  propertyId: string;
};

export function staffDashboardQueryKey(params: StaffDashboardQueryParams) {
  return [...staffDashboardQueryKeyPrefix, params] as const;
}
