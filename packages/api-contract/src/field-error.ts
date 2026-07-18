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
} as const;

/** Extra fields allowed on delete-conflict `error.details` alongside `field` / `reason`. */
export type HasChildrenDetails = ApiFieldError & {
  reason: typeof ApiFieldReason.HAS_CHILDREN;
  typeCount?: number;
  unitCount?: number;
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
