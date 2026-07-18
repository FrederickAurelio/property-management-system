import {
  ApiFieldReason,
  isApiFieldError,
  type ApiFieldReason as ApiFieldReasonType,
} from "@cabin/api-contract";
import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { ApiError, handleError } from "@/lib/api";

const FIELD_REASON_MESSAGE: Partial<Record<ApiFieldReasonType, string>> = {
  [ApiFieldReason.USERNAME_TAKEN]: "That username is already taken",
  [ApiFieldReason.INVALID_CURRENT_PASSWORD]: "Current password is incorrect",
  [ApiFieldReason.SAME_AS_CURRENT]:
    "New password must differ from the current one",
  [ApiFieldReason.USERNAME_UNCHANGED]: "Username is unchanged",
  [ApiFieldReason.CODE_TAKEN]: "This code is already in use",
  [ApiFieldReason.LAT_LNG_PAIR_REQUIRED]:
    "Enter both latitude and longitude",
  [ApiFieldReason.LAT_OUT_OF_RANGE]: "Enter a latitude between -90 and 90",
  [ApiFieldReason.LNG_OUT_OF_RANGE]: "Enter a longitude between -180 and 180",
  [ApiFieldReason.UNIT_TYPE_INVALID]: "Unit type not found on this property",
};

/**
 * Maps structured API field errors onto RHF. Returns true when handled
 * (caller should skip toast). Otherwise toasts via `handleError`.
 *
 * Only use for create/edit forms. Operational conflicts (e.g. `HAS_CHILDREN`
 * on delete) belong in dialogs/toasts — do not pass them here.
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
  if (reason === ApiFieldReason.HAS_CHILDREN) {
    handleError(error);
    return false;
  }

  const message =
    FIELD_REASON_MESSAGE[reason as ApiFieldReasonType] ?? error.message;

  setError(field as FieldPath<TFieldValues>, {
    type: "server",
    message,
  });
  return true;
}
