import type {
  StaffDashboard,
  StaffDashboardParams,
} from "@cabin/api-contract";
import { api } from "./client";

export type GetStaffDashboardParams = StaffDashboardParams;

export async function getStaffDashboard(
  params: GetStaffDashboardParams,
): Promise<StaffDashboard> {
  const { data } = await api.get<StaffDashboard>("/dashboard", {
    params: {
      propertyId: params.propertyId,
      ...(params.date ? { date: params.date } : {}),
    },
  });
  return data;
}
