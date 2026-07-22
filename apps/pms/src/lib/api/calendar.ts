/**
 * Property calendar API — fixture-backed until Nest aggregate ships.
 * Swap bodies to `api.get/post/patch/delete` without changing call sites.
 */
import type {
  CreateStaffCalendarBlockInput,
  StaffCalendarBlock,
  StaffCalendarStay,
  StaffPropertyCalendar,
  UpdateStaffCalendarBlockInput,
} from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import {
  fixtureAppendLiveStay,
  fixtureCreateCalendarBlock,
  fixtureDeleteCalendarBlock,
  fixtureGetPropertyCalendar,
  fixtureUpdateCalendarBlock,
} from "@/pages/calendar/fixtures/calendar-fixture";
import { staffPropertyCalendarQueryKeyPrefix } from "./query-keys";

export type GetPropertyCalendarParams = {
  propertyId: string;
  from: string;
  to: string;
};

export async function getPropertyCalendar(
  params: GetPropertyCalendarParams,
): Promise<StaffPropertyCalendar> {
  return fixtureGetPropertyCalendar(params);
}

export async function createCalendarBlock(
  input: CreateStaffCalendarBlockInput,
): Promise<StaffCalendarBlock> {
  return fixtureCreateCalendarBlock(input);
}

export async function updateCalendarBlock(
  id: string,
  input: UpdateStaffCalendarBlockInput,
): Promise<StaffCalendarBlock> {
  return fixtureUpdateCalendarBlock(id, input);
}

export async function deleteCalendarBlock(id: string): Promise<void> {
  return fixtureDeleteCalendarBlock(id);
}

/** Paint a live-created reservation on the fixture calendar until Nest aggregate exists. */
export function appendLiveStayToCalendarFixture(
  propertyId: string,
  stay: StaffCalendarStay,
): void {
  fixtureAppendLiveStay(propertyId, stay);
}

/**
 * After calendar-block create/update/delete — no per-block detail query key;
 * bust the property calendar aggregate (range keys under this prefix).
 * Prefer `sync*Caches` when a mutation returns a row that maps 1:1 to a GET detail.
 */
export function invalidatePropertyCalendarCaches(
  queryClient: QueryClient,
): void {
  void queryClient.invalidateQueries({
    queryKey: staffPropertyCalendarQueryKeyPrefix,
  });
}
