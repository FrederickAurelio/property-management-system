import type { StaffIcalSyncAllResult } from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./client";

export async function syncAllIcalFeeds(): Promise<StaffIcalSyncAllResult> {
  const { data } = await api.post<StaffIcalSyncAllResult>("/ical/sync-all");
  return data;
}

/**
 * After Sync all — import can create/update/cancel stubs, change occupancy,
 * calendar bars, availability, unit feed health, and reservation detail.
 * Bust the entire query cache (no usable mutation body to patch).
 */
export function invalidateIcalSyncCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries();
}
