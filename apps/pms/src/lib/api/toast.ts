import { toast } from "sonner";
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
  return error.message || "Validation failed";
}

function messageForApiError(error: ApiError): string {
  switch (error.code) {
    case ApiErrorCode.VALIDATION_FAILED:
      return validationMessage(error);
    case ApiErrorCode.TIMEOUT:
      return "Request timed out. Please try again.";
    case ApiErrorCode.NETWORK_ERROR:
      return "Network request failed. Check your connection.";
    case ApiErrorCode.SERVER_UNAVAILABLE:
      return "Cannot reach the server. It may be down — try again shortly.";
    case ApiErrorCode.INTERNAL_ERROR:
      return "Something went wrong. Please try again.";
    case ApiErrorCode.AUTH_UNAUTHORIZED:
    case ApiErrorCode.AUTH_FORBIDDEN:
    case ApiErrorCode.NOT_FOUND:
    case ApiErrorCode.CONFLICT:
    case ApiErrorCode.BAD_REQUEST:
      return error.message;
    default:
      return error.message || "Something went wrong";
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

  toast.error("Something went wrong");
}
