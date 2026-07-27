import type { StaffIcalSyncAllResult } from "@cabin/api-contract";
import { api } from "./client";

export async function syncAllIcalFeeds(): Promise<StaffIcalSyncAllResult> {
  const { data } = await api.post<StaffIcalSyncAllResult>("/ical/sync-all");
  return data;
}
