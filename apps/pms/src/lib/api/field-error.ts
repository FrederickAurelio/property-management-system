import {
  ApiFieldReason,
  isApiFieldError,
  type ApiFieldReason as ApiFieldReasonType,
} from "@cabin/api-contract";
import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { ApiError, handleError } from "@/lib/api";

const FIELD_REASON_MESSAGE: Record<ApiFieldReasonType, string> = {
  [ApiFieldReason.USERNAME_TAKEN]: "That username is already taken",
  [ApiFieldReason.INVALID_CURRENT_PASSWORD]: "Current password is incorrect",
  [ApiFieldReason.SAME_AS_CURRENT]:
    "New password must differ from the current one",
  [ApiFieldReason.USERNAME_UNCHANGED]: "Username is unchanged",
};

/**
 * Maps structured API field errors onto RHF. Returns true when handled
 * (caller should skip toast). Otherwise toasts via `handleError`.
 */
export function applyApiFieldError<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
): boolean {
  if (!(error instanceof ApiError) || !isApiFieldError(error.details)) {
    handleError(error);
    return false;
  }

  const { field, reason } = error.details;
  const message =
    FIELD_REASON_MESSAGE[reason as ApiFieldReasonType] ?? error.message;

  setError(field as FieldPath<TFieldValues>, {
    type: "server",
    message,
  });
  return true;
}
