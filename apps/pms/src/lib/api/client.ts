import { ApiError, ApiErrorCode, type ApiErrorBody, type ApiSuccess } from "./types";

const apiBaseUrl = () => {
  const base = import.meta.env.VITE_API_URL;
  if (typeof base !== "string" || base.length === 0) {
    throw new Error("VITE_API_URL is not set (repo root .env)");
  }
  return base.replace(/\/$/, "");
};

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip 401 → login hook (use for login itself). */
  skipUnauthorizedRedirect?: boolean;
};

/**
 * Hook for AUTH_UNAUTHORIZED (except login). Wire to router when routes exist.
 * Default: no-op; still throws ApiError.
 */
let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined): void {
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

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Typed fetch to Nest API. Session cookie via credentials: 'include'.
 * Success → unwraps `{ data }`. Error → throws `ApiError`.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, skipUnauthorizedRedirect, headers, ...rest } = options;
  const url = `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: ApiErrorCode.NETWORK_ERROR,
      message: "Network request failed",
    });
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      const err = new ApiError({
        status: response.status,
        code: payload.error.code,
        message: payload.error.message,
        details: payload.error.details,
        requestId: payload.meta?.requestId,
      });

      if (
        !skipUnauthorizedRedirect &&
        response.status === 401 &&
        err.code === ApiErrorCode.AUTH_UNAUTHORIZED
      ) {
        onUnauthorized?.();
      }

      throw err;
    }

    throw new ApiError({
      status: response.status,
      code: ApiErrorCode.INTERNAL_ERROR,
      message: response.statusText || "Request failed",
    });
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload
  ) {
    return (payload as ApiSuccess<T>).data;
  }

  throw new ApiError({
    status: response.status,
    code: ApiErrorCode.INTERNAL_ERROR,
    message: "Invalid API success envelope",
  });
}
