import type { AdminRole, PublicAdmin } from "@cabin/api-contract";
import { api } from "./client";

export async function listAdmins(): Promise<PublicAdmin[]> {
  const { data } = await api.get<PublicAdmin[]>("/admins");
  return data;
}

export async function createAdmin(input: {
  username: string;
  password: string;
  role: AdminRole;
  currentPassword: string;
}): Promise<PublicAdmin> {
  const { data } = await api.post<PublicAdmin>("/admins", input);
  return data;
}

export async function changeAdminRole(
  id: string,
  input: { role: AdminRole; currentPassword: string },
): Promise<PublicAdmin> {
  const { data } = await api.patch<PublicAdmin>(`/admins/${id}/role`, input);
  return data;
}

export async function setAdminActive(
  id: string,
  input: { isActive: boolean; currentPassword: string },
): Promise<PublicAdmin> {
  const { data } = await api.patch<PublicAdmin>(`/admins/${id}/active`, input);
  return data;
}
