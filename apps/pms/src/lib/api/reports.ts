import type {
  StaffReportsSummary,
  StaffReportsSummaryParams,
} from "@cabin/api-contract";
import { api } from "./client";
import { buildReportsFixture } from "@/pages/reports/reports-fixture";

/**
 * Flip to `true` only for offline UI review without Nest.
 * Live path: `GET /staff/reports/summary`.
 */
export const REPORTS_USE_FIXTURE = false;

const FIXTURE_DELAY_MS = 320;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type GetStaffReportsSummaryParams = StaffReportsSummaryParams;

export async function getStaffReportsSummary(
  params: GetStaffReportsSummaryParams,
): Promise<StaffReportsSummary> {
  if (REPORTS_USE_FIXTURE) {
    await sleep(FIXTURE_DELAY_MS);
    return buildReportsFixture(params);
  }

  const { data } = await api.get<StaffReportsSummary>(
    "/staff/reports/summary",
    {
      params: {
        propertyId: params.propertyId,
        from: params.from,
        to: params.to,
        compare: params.compare === false ? 0 : 1,
      },
    },
  );
  return data;
}
