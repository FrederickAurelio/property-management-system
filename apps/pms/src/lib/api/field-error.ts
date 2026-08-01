import {
  ApiFieldReason,
  isApiFieldError,
  type ApiFieldReason as ApiFieldReasonType,
} from "@cabin/api-contract";
import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import i18n from "@/i18n";
import { ApiError, handleError } from "@/lib/api";

const FIELD_REASON_KEY: Partial<Record<ApiFieldReasonType, string>> = {
  [ApiFieldReason.USERNAME_TAKEN]: "usernameTaken",
  [ApiFieldReason.INVALID_CURRENT_PASSWORD]: "invalidCurrentPassword",
  [ApiFieldReason.SAME_AS_CURRENT]: "sameAsCurrent",
  [ApiFieldReason.USERNAME_UNCHANGED]: "usernameUnchanged",
  [ApiFieldReason.CODE_TAKEN]: "codeTaken",
  [ApiFieldReason.LAT_LNG_PAIR_REQUIRED]: "latLngPairRequired",
  [ApiFieldReason.LAT_OUT_OF_RANGE]: "latOutOfRange",
  [ApiFieldReason.LNG_OUT_OF_RANGE]: "lngOutOfRange",
  [ApiFieldReason.UNIT_TYPE_INVALID]: "unitTypeInvalid",
  [ApiFieldReason.UNIT_NOT_BOOKABLE]: "unitNotBookable",
  [ApiFieldReason.DATE_RANGE_INVALID]: "dateRangeInvalid",
  [ApiFieldReason.STAY_PERIOD_MISMATCH]: "stayPeriodMismatch",
  [ApiFieldReason.OVERLAP_CONFLICT]: "overlapConflict",
  [ApiFieldReason.CONFIRM_INCOMPLETE]: "confirmIncomplete",
  [ApiFieldReason.GUEST_COUNT_EXCEEDS_MAX]: "guestCountExceedsMax",
  [ApiFieldReason.CANCEL_DISPOSITION_REQUIRED]: "cancelDispositionRequired",
  [ApiFieldReason.REFUND_AMOUNT_INVALID]: "refundAmountInvalid",
  [ApiFieldReason.MOVEMENT_EXCEEDS_DUE]: "movementExceedsDue",
  [ApiFieldReason.EARLY_CONFIRM_REQUIRED]: "earlyConfirmRequired",
  [ApiFieldReason.INVALID_STATUS_TRANSITION]: "invalidStatusTransition",
  [ApiFieldReason.SOURCE_LOCKED_WITH_EXTERNAL_REF]:
    "sourceLockedWithExternalRef",
};

/** Looks up the i18n message for a mapped `ApiFieldReason`, if any. */
function getFieldReasonMessage(reason: ApiFieldReasonType): string | undefined {
  const key = FIELD_REASON_KEY[reason];
  return key ? i18n.t(`errors:fieldReasons.${key}`) : undefined;
}

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

  // Prefer Nest message when it names the conflicting guest / stay.
  const mapped = getFieldReasonMessage(reason as ApiFieldReasonType);
  const message =
    reason === ApiFieldReason.OVERLAP_CONFLICT && error.message
      ? error.message
      : (mapped ?? error.message);

  setError(field as FieldPath<TFieldValues>, {
    type: "server",
    message,
  });
  return true;
}
