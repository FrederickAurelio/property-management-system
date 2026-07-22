/**
 * Staff reservations API — Nest `/staff/reservations`.
 */
import {
  PAGE_SIZE_DEFAULT,
  type CancelDisposition,
  type CancelStaffReservationInput,
  type ConfirmEarlyInput,
  type CreateStaffReservationInput,
  type Paginated,
  type PostPaymentMovementInput,
  type StaffReservation,
  type StaffReservationListFilters,
  type StaffReservationListItem,
  type UpdateStaffReservationInput,
} from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import {
  staffPropertyCalendarQueryKeyPrefix,
  staffReservationQueryKey,
  staffReservationsListQueryKeyPrefix,
  staffUnitsAvailabilityQueryKeyPrefix,
  staffUnitsOccupancyQueryKeyPrefix,
} from "./query-keys";

export type ListReservationsParams = StaffReservationListFilters & {
  page?: number;
  pageSize?: number;
};

export type CreateReservationInput = CreateStaffReservationInput;
export type UpdateReservationInput = UpdateStaffReservationInput;
export type { PostPaymentMovementInput };
export type CancelReservationInput = CancelStaffReservationInput;
export type { CancelDisposition };

export type SyncReservationCachesOptions = {
  /**
   * Occupying nights may have changed (create, unit/dates PATCH, checkout, cancel).
   * Skipped for money-only / confirm / check-in (still occupying).
   */
  occupancyChanged?: boolean;
};

/**
 * After a mutation that returns the full reservation row:
 * - write detail from the response (no detail refetch)
 * - invalidate list/board queries only
 * - always refresh property calendar (status / Late / money cues on bars)
 * - optionally refresh availability + occupancy (not inventory unit lists)
 */
export function syncReservationCaches(
  queryClient: QueryClient,
  reservation: StaffReservation,
  opts: SyncReservationCachesOptions = {},
): void {
  queryClient.setQueryData(
    staffReservationQueryKey(reservation.id),
    reservation,
  );
  void queryClient.invalidateQueries({
    queryKey: staffReservationsListQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffPropertyCalendarQueryKeyPrefix,
  });
  if (opts.occupancyChanged) {
    void queryClient.invalidateQueries({
      queryKey: staffUnitsAvailabilityQueryKeyPrefix,
    });
    void queryClient.invalidateQueries({
      queryKey: staffUnitsOccupancyQueryKeyPrefix,
    });
  }
}

export async function listReservations(
  params: ListReservationsParams = {},
): Promise<Paginated<StaffReservationListItem>> {
  const { page = 1, pageSize = PAGE_SIZE_DEFAULT, ...filters } = params;
  const { data } = await api.get<Paginated<StaffReservationListItem>>(
    "/staff/reservations",
    {
      params: {
        page,
        pageSize,
        ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.board ? { board: filters.board } : {}),
        ...(filters.sort ? { sort: filters.sort } : {}),
        ...(filters.checkInDate ? { checkInDate: filters.checkInDate } : {}),
        ...(filters.checkOutDate ? { checkOutDate: filters.checkOutDate } : {}),
        ...(filters.hasIcalWarning !== undefined
          ? { hasIcalWarning: filters.hasIcalWarning }
          : {}),
        ...(filters.occupyingOnly !== undefined
          ? { occupyingOnly: filters.occupyingOnly }
          : {}),
      },
    },
  );
  return data;
}

export async function getReservation(id: string): Promise<StaffReservation> {
  const { data } = await api.get<StaffReservation>(
    `/staff/reservations/${id}`,
  );
  return data;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<StaffReservation> {
  const { data } = await api.post<StaffReservation>(
    "/staff/reservations",
    input,
  );
  return data;
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
): Promise<StaffReservation> {
  const { data } = await api.patch<StaffReservation>(
    `/staff/reservations/${id}`,
    input,
  );
  return data;
}

/** Cash goes through postPaymentMovement only — no absolute Paid rewrite API. */
export async function postPaymentMovement(
  id: string,
  input: PostPaymentMovementInput,
): Promise<StaffReservation> {
  const { data } = await api.post<StaffReservation>(
    `/staff/reservations/${id}/movements`,
    input,
  );
  return data;
}

export async function confirmReservation(
  id: string,
): Promise<StaffReservation> {
  const { data } = await api.post<StaffReservation>(
    `/staff/reservations/${id}/confirm`,
  );
  return data;
}

export async function checkInReservation(
  id: string,
  input: ConfirmEarlyInput = {},
): Promise<StaffReservation> {
  const { data } = await api.post<StaffReservation>(
    `/staff/reservations/${id}/check-in`,
    input,
  );
  return data;
}

export async function checkOutReservation(
  id: string,
  input: ConfirmEarlyInput = {},
): Promise<StaffReservation> {
  const { data } = await api.post<StaffReservation>(
    `/staff/reservations/${id}/check-out`,
    input,
  );
  return data;
}

export async function cancelReservation(
  id: string,
  input: CancelReservationInput = {},
): Promise<StaffReservation> {
  const { data } = await api.post<StaffReservation>(
    `/staff/reservations/${id}/cancel`,
    input,
  );
  return data;
}
