import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import i18n from "@/i18n";
import {
  ApiError,
  ApiErrorCode,
  type ApiErrorBody,
  type ApiSuccess,
} from "./types";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Skip 401 → login hook (use for login itself). */
    skipUnauthorizedRedirect?: boolean;
  }
}

const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * Hooks for AUTH_UNAUTHORIZED (except login). Wire in `UnauthorizedRedirect`.
 * Default: no-op; still throws ApiError.
 */
let onUnauthorized: (() => void) | undefined;
let onSessionInvalidated: (() => void) | undefined;
let onForceLogout: (() => void) | undefined;

let unauthorizedStreak = 0;
let lastUnauthorizedAt = 0;
let unauthorizedNavigatePending = false;

const UNAUTHORIZED_STREAK_WINDOW_MS = 60_000;
const UNAUTHORIZED_FORCE_LOGOUT_COUNT = 3;
const UNAUTHORIZED_NAV_DEBOUNCE_MS = 500;

export function setUnauthorizedHandler(
  handler: (() => void) | undefined,
): void {
  onUnauthorized = handler;
}

/** Clear cached session row when the cookie is rejected (before redirect). */
export function setSessionInvalidatedHandler(
  handler: (() => void) | undefined,
): void {
  onSessionInvalidated = handler;
}

/** After repeated AUTH_UNAUTHORIZED, wipe client state to break redirect/toast loops. */
export function setForceLogoutHandler(handler: (() => void) | undefined): void {
  onForceLogout = handler;
}

/** Call after a verified login so streak counting does not carry over. */
export function resetUnauthorizedStreak(): void {
  unauthorizedStreak = 0;
  lastUnauthorizedAt = 0;
  unauthorizedNavigatePending = false;
}

function handleAuthUnauthorized(): void {
  const now = Date.now();
  if (now - lastUnauthorizedAt > UNAUTHORIZED_STREAK_WINDOW_MS) {
    unauthorizedStreak = 0;
  }
  lastUnauthorizedAt = now;
  unauthorizedStreak += 1;

  onSessionInvalidated?.();

  if (unauthorizedStreak >= UNAUTHORIZED_FORCE_LOGOUT_COUNT) {
    unauthorizedStreak = 0;
    onForceLogout?.();
  }

  if (unauthorizedNavigatePending) {
    return;
  }

  unauthorizedNavigatePending = true;
  onUnauthorized?.();
  window.setTimeout(() => {
    unauthorizedNavigatePending = false;
  }, UNAUTHORIZED_NAV_DEBOUNCE_MS);
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = (value as ApiErrorBody).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

function isApiSuccessEnvelope(value: unknown): value is ApiSuccess<unknown> {
  return typeof value === "object" && value !== null && "data" in value;
}

function mapAxiosError(error: AxiosError): ApiError {
  const config = error.config as InternalAxiosRequestConfig | undefined;
  const skipUnauthorizedRedirect = Boolean(config?.skipUnauthorizedRedirect);

  if (error.response) {
    const { status, data } = error.response;

    if (GATEWAY_STATUSES.has(status)) {
      // Prefer Nest's JSON body when present (e.g. migrate hint on 503).
      if (isApiErrorBody(data)) {
        return new ApiError({
          status,
          code: data.error.code,
          message: data.error.message,
          details: data.error.details,
          requestId: data.meta?.requestId,
        });
      }
      return new ApiError({
        status,
        code: ApiErrorCode.SERVER_UNAVAILABLE,
        message: i18n.t("errors:serverUnavailableShort"),
      });
    }

    if (isApiErrorBody(data)) {
      const apiError = new ApiError({
        status,
        code: data.error.code,
        message: data.error.message,
        details: data.error.details,
        requestId: data.meta?.requestId,
      });

      if (
        !skipUnauthorizedRedirect &&
        status === 401 &&
        apiError.code === ApiErrorCode.AUTH_UNAUTHORIZED
      ) {
        handleAuthUnauthorized();
      }

      return apiError;
    }

    return new ApiError({
      status,
      code: ApiErrorCode.INTERNAL_ERROR,
      message: error.response.statusText || i18n.t("errors:requestFailed"),
    });
  }

  if (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    error.message.toLowerCase().includes("timeout")
  ) {
    return new ApiError({
      status: 0,
      code: ApiErrorCode.TIMEOUT,
      message: i18n.t("errors:timeoutShort"),
    });
  }

  if (
    error.code === "ERR_NETWORK" ||
    error.code === "ECONNREFUSED" ||
    error.message.toLowerCase().includes("network")
  ) {
    const refused =
      error.code === "ECONNREFUSED" ||
      error.message.toLowerCase().includes("refused");

    return new ApiError({
      status: 0,
      code: refused
        ? ApiErrorCode.SERVER_UNAVAILABLE
        : ApiErrorCode.NETWORK_ERROR,
      message: refused
        ? i18n.t("errors:serverUnavailableShort")
        : i18n.t("errors:networkErrorShort"),
    });
  }

  return new ApiError({
    status: 0,
    code: ApiErrorCode.NETWORK_ERROR,
    message: i18n.t("errors:networkErrorShort"),
  });
}

/**
 * Shared axios instance — use `api.get` / `api.post` / …
 * Call paths are audience-free (`/auth/...`, `/reservations/...`).
 * baseURL `/api` → browser `/api/...`; Vite/nginx rewrite to Nest `/staff/...`.
 */
export const api: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30_000,
  headers: {
    Accept: "application/json",
    "x-cabin-app": "pms",
  },
});

api.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data as unknown;

    // Raw PDF / file downloads skip the JSON `{ data }` envelope.
    if (
      response.config.responseType === "blob" ||
      response.config.responseType === "arraybuffer"
    ) {
      return response;
    }

    if (isApiSuccessEnvelope(payload)) {
      // Nest wraps success as `{ data, meta? }` — callers get unwrapped `data`.
      return { ...response, data: payload.data };
    }

    return Promise.reject(
      new ApiError({
        status: response.status,
        code: ApiErrorCode.INTERNAL_ERROR,
        message: i18n.t("errors:invalidSuccessEnvelope"),
      }),
    );
  },
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (
        error.response &&
        typeof Blob !== "undefined" &&
        error.response.data instanceof Blob
      ) {
        try {
          const parsed: unknown = JSON.parse(await error.response.data.text());
          error.response.data = parsed as typeof error.response.data;
        } catch {
          // Keep the Blob; mapAxiosError falls back to status text.
        }
      }
      return Promise.reject(mapAxiosError(error));
    }

    if (error instanceof ApiError) {
      return Promise.reject(error);
    }

    return Promise.reject(
      new ApiError({
        status: 0,
        code: ApiErrorCode.NETWORK_ERROR,
        message: i18n.t("errors:networkErrorShort"),
      }),
    );
  },
);
