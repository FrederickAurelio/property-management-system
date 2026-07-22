/** Domain field error in `error.details` (not class-validator string[]). */
export type ApiFieldError = {
  field: string;
  reason: string;
};

export const ApiFieldReason = {
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  INVALID_CURRENT_PASSWORD: 'INVALID_CURRENT_PASSWORD',
  SAME_AS_CURRENT: 'SAME_AS_CURRENT',
  USERNAME_UNCHANGED: 'USERNAME_UNCHANGED',
  CODE_TAKEN: 'CODE_TAKEN',
  HAS_CHILDREN: 'HAS_CHILDREN',
  /** One of latitude/longitude set without the other — `field` is the missing side. */
  LAT_LNG_PAIR_REQUIRED: 'LAT_LNG_PAIR_REQUIRED',
  LAT_OUT_OF_RANGE: 'LAT_OUT_OF_RANGE',
  LNG_OUT_OF_RANGE: 'LNG_OUT_OF_RANGE',
  /** Unit create: unitTypeId missing or not under the path property. */
  UNIT_TYPE_INVALID: 'UNIT_TYPE_INVALID',
  /** Unit/property/type not open for booking (catalog or status). */
  UNIT_NOT_BOOKABLE: 'UNIT_NOT_BOOKABLE',
  DATE_RANGE_INVALID: 'DATE_RANGE_INVALID',
  /** Occupying stay overlaps — see OverlapConflictDetails. */
  OVERLAP_CONFLICT: 'OVERLAP_CONFLICT',
  CONFIRM_INCOMPLETE: 'CONFIRM_INCOMPLETE',
  /** guestCount above UnitType.maxGuests — `field` is guestCount. */
  GUEST_COUNT_EXCEEDS_MAX: 'GUEST_COUNT_EXCEEDS_MAX',
  CANCEL_DISPOSITION_REQUIRED: 'CANCEL_DISPOSITION_REQUIRED',
  REFUND_AMOUNT_INVALID: 'REFUND_AMOUNT_INVALID',
  MOVEMENT_EXCEEDS_DUE: 'MOVEMENT_EXCEEDS_DUE',
  EARLY_CONFIRM_REQUIRED: 'EARLY_CONFIRM_REQUIRED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
} as const;

/** Extra fields allowed on delete-conflict `error.details` alongside `field` / `reason`. */
export type HasChildrenDetails = ApiFieldError & {
  reason: typeof ApiFieldReason.HAS_CHILDREN;
  typeCount?: number;
  unitCount?: number;
  reservationCount?: number;
};

/** 409 overlap — highlight stay dates (`checkInDate` / `startDate`), not unit. */
export type OverlapConflictDetails = ApiFieldError & {
  reason: typeof ApiFieldReason.OVERLAP_CONFLICT;
  conflictingReservation?: {
    id: string;
    guestName: string;
    source: string;
    checkInDate: string;
    checkOutDate: string;
    status: string;
  };
  conflictingBlock?: {
    id: string;
    kind: string;
    startDate: string;
    endDate: string;
  };
};

export type ApiFieldReason =
  (typeof ApiFieldReason)[keyof typeof ApiFieldReason];

export function isApiFieldError(value: unknown): value is ApiFieldError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.field === 'string' && typeof record.reason === 'string';
}
