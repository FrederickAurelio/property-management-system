import { toast } from "sonner";
import i18n from "@/i18n";
import { ApiError, ApiErrorCode } from "./types";

function validationMessage(error: ApiError): string {
  if (Array.isArray(error.details)) {
    const parts = error.details.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    if (parts.length > 0) {
      return parts.join(". ");
    }
  }
  return error.message || i18n.t("errors:validationFailed");
}

function messageForApiError(error: ApiError): string {
  switch (error.code) {
    case ApiErrorCode.VALIDATION_FAILED:
      return validationMessage(error);
    case ApiErrorCode.TIMEOUT:
      return i18n.t("errors:timeout");
    case ApiErrorCode.NETWORK_ERROR:
      return i18n.t("errors:networkError");
    case ApiErrorCode.SERVER_UNAVAILABLE:
      return i18n.t("errors:serverUnavailable");
    case ApiErrorCode.INTERNAL_ERROR: {
      const msg = error.message?.trim() ?? "";
      if (/does not exist in the current database/i.test(msg)) {
        return i18n.t("errors:databaseOutOfDate");
      }
      // Prefer short server message; avoid dumping full Prisma stacks in the toast.
      if (msg && !msg.includes("\nInvalid `")) {
        return msg;
      }
      if (msg.includes("\nInvalid `")) {
        const first = msg.split("\n").find((line) => line.trim().length > 0);
        return first?.trim() || i18n.t("errors:somethingWentWrongRetry");
      }
      return i18n.t("errors:somethingWentWrongRetry");
    }
    case ApiErrorCode.AUTH_UNAUTHORIZED:
    case ApiErrorCode.AUTH_FORBIDDEN:
    case ApiErrorCode.NOT_FOUND:
    case ApiErrorCode.CONFLICT:
    case ApiErrorCode.BAD_REQUEST:
      return error.message;
    default:
      return error.message || i18n.t("errors:somethingWentWrong");
  }
}

/** Toast a success message (Sonner). */
export function handleSuccess(message: string): void {
  toast.success(message);
}

/** Toast an error from `ApiError` or unknown throwables (Sonner). */
export function handleError(error: unknown): void {
  if (error instanceof ApiError) {
    toast.error(messageForApiError(error));
    return;
  }

  if (error instanceof Error && error.message) {
    toast.error(error.message);
    return;
  }

  toast.error(i18n.t("errors:somethingWentWrong"));
}
