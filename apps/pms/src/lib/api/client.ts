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
 * Hook for AUTH_UNAUTHORIZED (except login). Wire to router when routes exist.
 * Default: no-op; still throws ApiError.
 */
let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(
  handler: (() => void) | undefined,
): void {
  onUnauthorized = handler;
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
        onUnauthorized?.();
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
  },
});

api.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data as unknown;

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
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
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
