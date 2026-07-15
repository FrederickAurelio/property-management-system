import { apiRequest } from "./client";

export type PublicAdmin = {
  id: string;
  username: string;
  role: "SUPER_ADMIN" | "ADMIN" | "FRONT_DESK";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function login(username: string, password: string): Promise<PublicAdmin> {
  return apiRequest<PublicAdmin>("/auth/login", {
    method: "POST",
    body: { username, password },
    skipUnauthorizedRedirect: true,
  });
}

export function logout(): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>("/auth/logout", {
    method: "POST",
  });
}

export function me(): Promise<PublicAdmin> {
  return apiRequest<PublicAdmin>("/auth/me");
}
