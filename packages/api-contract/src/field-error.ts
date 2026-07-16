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
} as const;

export type ApiFieldReason =
  (typeof ApiFieldReason)[keyof typeof ApiFieldReason];

export function isApiFieldError(value: unknown): value is ApiFieldError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.field === 'string' && typeof record.reason === 'string';
}
