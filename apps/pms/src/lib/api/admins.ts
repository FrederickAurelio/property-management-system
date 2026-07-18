import type { AdminRole, StaffAdmin } from "@cabin/api-contract";
import { api } from "./client";

export async function listAdmins(): Promise<StaffAdmin[]> {
  const { data } = await api.get<StaffAdmin[]>("/staff/admins");
  return data;
}

export async function createAdmin(input: {
  username: string;
  password: string;
  role: AdminRole;
  currentPassword: string;
}): Promise<StaffAdmin> {
  const { data } = await api.post<StaffAdmin>("/staff/admins", input);
  return data;
}

export async function changeAdminRole(
  id: string,
  input: { role: AdminRole; currentPassword: string },
): Promise<StaffAdmin> {
  const { data } = await api.patch<StaffAdmin>(
    `/staff/admins/${id}/role`,
    input,
  );
  return data;
}

export async function setAdminActive(
  id: string,
  input: { isActive: boolean; currentPassword: string },
): Promise<StaffAdmin> {
  const { data } = await api.patch<StaffAdmin>(
    `/staff/admins/${id}/active`,
    input,
  );
  return data;
}
