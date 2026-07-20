/**
 * Staff reservations API helpers.
 * Currently backed by an in-memory fixture — replace bodies with `api.*`
 * when Nest `/staff/reservations` ships.
 */
import {
  PAGE_SIZE_DEFAULT,
  type Paginated,
  type StaffReservation,
} from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import {
  staffReservationQueryKey,
  staffReservationsQueryKeyPrefix,
} from "./query-keys";
import {
  fixtureCancelReservation,
  fixtureCheckInReservation,
  fixtureCheckOutReservation,
  fixtureConfirmReservation,
  fixtureCreateReservation,
  fixtureGetReservation,
  fixtureListReservations,
  fixturePostPaymentMovement,
  fixtureUpdateReservation,
  type CancelDisposition,
  type FixtureCancelInput,
  type FixtureCreateInput,
  type FixtureListFilters,
  type FixturePostMovementInput,
  type FixtureUpdateInput,
} from "./reservations-fixture";

export type ListReservationsParams = FixtureListFilters & {
  page?: number;
  pageSize?: number;
};

export type CreateReservationInput = FixtureCreateInput;
export type UpdateReservationInput = FixtureUpdateInput;
export type PostPaymentMovementInput = FixturePostMovementInput;
export type CancelReservationInput = FixtureCancelInput;
export type { CancelDisposition };

/** Invalidate reservation list (+ optional detail) after a mutation. */
export function invalidateReservationCaches(
  queryClient: QueryClient,
  reservationId?: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: staffReservationsQueryKeyPrefix,
  });
  if (reservationId) {
    void queryClient.invalidateQueries({
      queryKey: staffReservationQueryKey(reservationId),
    });
  }
}

export async function listReservations(
  params: ListReservationsParams = {},
): Promise<Paginated<StaffReservation>> {
  const { page = 1, pageSize = PAGE_SIZE_DEFAULT, ...filters } = params;
  await Promise.resolve();
  return fixtureListReservations(filters, page, pageSize);
}

export async function getReservation(id: string): Promise<StaffReservation> {
  await Promise.resolve();
  const row = fixtureGetReservation(id);
  if (!row) {
    throw new Error(`Reservation not found: ${id}`);
  }
  return row;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<StaffReservation> {
  await Promise.resolve();
  return fixtureCreateReservation(input);
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
): Promise<StaffReservation> {
  await Promise.resolve();
  return fixtureUpdateReservation(id, input);
}

/** Cash goes through postPaymentMovement only — no absolute Paid rewrite API. */
export async function postPaymentMovement(
  id: string,
  input: PostPaymentMovementInput,
): Promise<StaffReservation> {
  await Promise.resolve();
  return fixturePostPaymentMovement(id, input);
}

export async function confirmReservation(
  id: string,
): Promise<StaffReservation> {
  await Promise.resolve();
  return fixtureConfirmReservation(id);
}

export async function checkInReservation(
  id: string,
): Promise<StaffReservation> {
  await Promise.resolve();
  return fixtureCheckInReservation(id);
}

export async function checkOutReservation(
  id: string,
): Promise<StaffReservation> {
  await Promise.resolve();
  return fixtureCheckOutReservation(id);
}

export async function cancelReservation(
  id: string,
  input: CancelReservationInput = {},
): Promise<StaffReservation> {
  await Promise.resolve();
  return fixtureCancelReservation(id, input);
}
