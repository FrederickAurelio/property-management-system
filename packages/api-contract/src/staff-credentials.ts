/** Shared staff username / password bounds (Nest DTOs + FE Zod). */
export const STAFF_USERNAME_MIN = 3;
export const STAFF_USERNAME_MAX = 64;
export const STAFF_PASSWORD_MIN = 8;
export const STAFF_PASSWORD_MAX = 128;

/** Letters, numbers, dots, hyphens, underscores. */
export const STAFF_USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
