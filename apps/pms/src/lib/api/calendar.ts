/**
 * Property calendar API — Nest aggregate + calendar-block CRUD.
 */
import type {
  CreateStaffCalendarBlockInput,
  StaffCalendarBlock,
  StaffPropertyCalendar,
  UpdateStaffCalendarBlockInput,
} from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import {
  staffPropertyCalendarQueryKeyPrefix,
  staffUnitsAvailabilityQueryKeyPrefix,
  staffUnitsOccupancyQueryKeyPrefix,
} from "./query-keys";

export type GetPropertyCalendarParams = {
  propertyId: string;
  from: string;
  to: string;
};

export async function getPropertyCalendar(
  params: GetPropertyCalendarParams,
): Promise<StaffPropertyCalendar> {
  const { data } = await api.get<StaffPropertyCalendar>(
    `/properties/${params.propertyId}/calendar`,
    { params: { from: params.from, to: params.to } },
  );
  return data;
}

export async function createCalendarBlock(
  input: CreateStaffCalendarBlockInput,
): Promise<StaffCalendarBlock> {
  const { data } = await api.post<StaffCalendarBlock>(
    "/calendar-blocks",
    input,
  );
  return data;
}

export async function updateCalendarBlock(
  id: string,
  input: UpdateStaffCalendarBlockInput,
): Promise<StaffCalendarBlock> {
  const { data } = await api.patch<StaffCalendarBlock>(
    `/calendar-blocks/${id}`,
    input,
  );
  return data;
}

export async function deleteCalendarBlock(id: string): Promise<void> {
  await api.delete(`/calendar-blocks/${id}`);
}

/**
 * After calendar-block create/update/delete — no per-block detail query key;
 * bust the property calendar aggregate + busy-night derived queries.
 */
export function invalidatePropertyCalendarCaches(
  queryClient: QueryClient,
): void {
  void queryClient.invalidateQueries({
    queryKey: staffPropertyCalendarQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffUnitsAvailabilityQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffUnitsOccupancyQueryKeyPrefix,
  });
}
