import type { AdminRole, StaffAdmin } from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { staffAdminsQueryKey } from "./query-keys";

/** Mutation returns full `StaffAdmin` — patch the unpaginated list in place. */
export function syncStaffAdminCaches(
  queryClient: QueryClient,
  admin: StaffAdmin,
): void {
  queryClient.setQueryData(
    staffAdminsQueryKey,
    (prev: StaffAdmin[] | undefined) => {
      if (!prev) {
        return [admin];
      }
      const index = prev.findIndex((row) => row.id === admin.id);
      if (index === -1) {
        return [...prev, admin];
      }
      const next = [...prev];
      next[index] = admin;
      return next;
    },
  );
}

export async function listAdmins(): Promise<StaffAdmin[]> {
  const { data } = await api.get<StaffAdmin[]>("/admins");
  return data;
}

export async function createAdmin(input: {
  username: string;
  password: string;
  role: AdminRole;
  currentPassword: string;
}): Promise<StaffAdmin> {
  const { data } = await api.post<StaffAdmin>("/admins", input);
  return data;
}

export async function changeAdminRole(
  id: string,
  input: { role: AdminRole; currentPassword: string },
): Promise<StaffAdmin> {
  const { data } = await api.patch<StaffAdmin>(`/admins/${id}/role`, input);
  return data;
}

export async function setAdminActive(
  id: string,
  input: { isActive: boolean; currentPassword: string },
): Promise<StaffAdmin> {
  const { data } = await api.patch<StaffAdmin>(`/admins/${id}/active`, input);
  return data;
}
