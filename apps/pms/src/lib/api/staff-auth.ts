import type { AxiosRequestConfig } from "axios";
import type { StaffAdmin } from "@cabin/api-contract";
import { api } from "./client";

export type { StaffAdmin };

export async function staffLogin(
  username: string,
  password: string,
): Promise<StaffAdmin> {
  const { data } = await api.post<StaffAdmin>(
    "/auth/login",
    { username, password },
    { skipUnauthorizedRedirect: true },
  );
  return data;
}

export async function staffLogout(): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/auth/logout");
  return data;
}

/** Current staff from session cookie (no password). */
export async function staffSession(
  config?: AxiosRequestConfig,
): Promise<StaffAdmin> {
  const { data } = await api.get<StaffAdmin>("/auth/session", config);
  return data;
}

export async function staffChangeUsername(input: {
  username: string;
  currentPassword: string;
}): Promise<StaffAdmin> {
  const { data } = await api.patch<StaffAdmin>("/auth/username", input);
  return data;
}

export async function staffChangePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  const { data } = await api.patch<{ ok: true }>("/auth/password", input);
  return data;
}
