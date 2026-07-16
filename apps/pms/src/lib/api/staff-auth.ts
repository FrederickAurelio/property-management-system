import type { AxiosRequestConfig } from "axios";
import type { PublicAdmin } from "@cabin/api-contract";
import { api } from "./client";

export type { PublicAdmin };

export async function staffLogin(
  username: string,
  password: string,
): Promise<PublicAdmin> {
  const { data } = await api.post<PublicAdmin>(
    "/staff/auth/login",
    { username, password },
    { skipUnauthorizedRedirect: true },
  );
  return data;
}

export async function staffLogout(): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/staff/auth/logout");
  return data;
}

/** Current staff from session cookie (no password). */
export async function staffSession(
  config?: AxiosRequestConfig,
): Promise<PublicAdmin> {
  const { data } = await api.get<PublicAdmin>("/staff/auth/session", config);
  return data;
}
