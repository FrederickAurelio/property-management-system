import type { PublicAdmin } from "@cabin/api-contract";
import { apiRequest } from "./client";

export type { PublicAdmin };

export function staffLogin(
  username: string,
  password: string,
): Promise<PublicAdmin> {
  return apiRequest<PublicAdmin>("/staff/auth/login", {
    method: "POST",
    body: { username, password },
    skipUnauthorizedRedirect: true,
  });
}

export function staffLogout(): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>("/staff/auth/logout", {
    method: "POST",
  });
}

export function staffMe(): Promise<PublicAdmin> {
  return apiRequest<PublicAdmin>("/staff/auth/me");
}
