import type {
  StaffRequestLogsList,
  StaffRequestLogsParams,
} from "@cabin/api-contract";
import { api } from "./client";

export type ListRequestLogsParams = StaffRequestLogsParams;

export async function listRequestLogs(
  params: ListRequestLogsParams,
): Promise<StaffRequestLogsList> {
  const { data } = await api.get<StaffRequestLogsList>("/request-logs", {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      ...(params.from ? { from: params.from } : {}),
      ...(params.to ? { to: params.to } : {}),
      ...(params.q ? { q: params.q } : {}),
      ...(params.app ? { app: params.app } : {}),
      ...(params.actor ? { actor: params.actor } : {}),
      ...(params.path ? { path: params.path } : {}),
      ...(params.errorsOnly ? { errorsOnly: 1 } : {}),
      ...(params.requestId ? { requestId: params.requestId } : {}),
    },
  });
  return data;
}
