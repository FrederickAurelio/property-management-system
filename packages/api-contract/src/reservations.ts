/** Keep in sync with Prisma `ReservationSource` (when added). */
export const ReservationSource = {
  MANUAL: 'MANUAL',
  WEBSITE: 'WEBSITE',
  BOOKING_COM: 'BOOKING_COM',
  AIRBNB: 'AIRBNB',
  AGODA: 'AGODA',
} as const;

export type ReservationSource =
  (typeof ReservationSource)[keyof typeof ReservationSource];

/** Keep in sync with Prisma `ReservationStatus` (when added). */
export const ReservationStatus = {
  UNCONFIRMED: 'UNCONFIRMED',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

/** Occupying statuses — block the unit calendar. */
export const OCCUPYING_RESERVATION_STATUSES: readonly ReservationStatus[] = [
  ReservationStatus.UNCONFIRMED,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
] as const;

export function isOccupyingReservationStatus(
  status: ReservationStatus,
): boolean {
  return (OCCUPYING_RESERVATION_STATUSES as readonly string[]).includes(status);
}

/** Desk meaning: what the guest still owes at the property. */
export const PaymentStatus = {
  UNPAID: 'UNPAID',
  DEPOSIT: 'DEPOSIT',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const CollectedVia = {
  PROPERTY: 'PROPERTY',
  CHANNEL: 'CHANNEL',
  MIXED: 'MIXED',
} as const;

export type CollectedVia = (typeof CollectedVia)[keyof typeof CollectedVia];

/** Cash movement direction — property money in / out (design §6). */
export const PaymentMovementDirection = {
  IN: 'IN',
  OUT: 'OUT',
} as const;

export type PaymentMovementDirection =
  (typeof PaymentMovementDirection)[keyof typeof PaymentMovementDirection];

/**
 * Why cash moved. Quote (Total) edits are not movements.
 * Nest persists the same kinds when `/staff/reservations` lands.
 */
export const PaymentMovementKind = {
  DEPOSIT: 'DEPOSIT',
  TOP_UP: 'TOP_UP',
  REFUND: 'REFUND',
  CANCEL_REFUND: 'CANCEL_REFUND',
  CHANNEL_SETTLED: 'CHANNEL_SETTLED',
} as const;

export type PaymentMovementKind =
  (typeof PaymentMovementKind)[keyof typeof PaymentMovementKind];

/** Append-only cash line. Paid on reservation = sum(signedAmount). */
export type PaymentMovement = {
  id: string;
  reservationId: string;
  direction: PaymentMovementDirection;
  kind: PaymentMovementKind;
  /** Always > 0. */
  amountIdr: number;
  /** +amount (IN) or −amount (OUT). */
  signedAmount: number;
  method: CollectedVia | null;
  note: string | null;
  createdAt: string;
  createdByStaffId: string | null;
};

export const PAYMENT_MOVEMENT_NOTE_MAX = 500;

export function signedAmountFor(
  direction: PaymentMovementDirection,
  amountIdr: number,
): number {
  const amount = Math.floor(amountIdr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return direction === PaymentMovementDirection.IN ? amount : -amount;
}

/** Denormalized Paid = sum of movement signed amounts (never negative). */
export function sumPaidFromMovements(
  movements: ReadonlyArray<Pick<PaymentMovement, 'signedAmount'>>,
): number {
  let sum = 0;
  for (const m of movements) {
    sum += m.signedAmount;
  }
  return Math.max(0, sum);
}

export const IcalSyncWarning = {
  MISSING_FROM_FEED: 'MISSING_FROM_FEED',
  DATES_DIFFER: 'DATES_DIFFER',
} as const;

export type IcalSyncWarning =
  (typeof IcalSyncWarning)[keyof typeof IcalSyncWarning];

/** Guest / notes bounds for Zod + Nest DTOs. */
export const RESERVATION_GUEST_NAME_MIN = 1;
export const RESERVATION_GUEST_NAME_MAX = 128;
export const RESERVATION_GUEST_EMAIL_MAX = 254;
export const RESERVATION_GUEST_PHONE_MAX = 32;
export const RESERVATION_NOTES_MAX = 4000;
export const RESERVATION_EXTERNAL_REF_MAX = 256;

/**
 * Recompute paymentStatus from amounts (doc §6).
 * Force `REFUNDED` only when explicitly set by a cancel/refund path.
 */
export function recomputePaymentStatus(input: {
  totalAmountIdr: number | null;
  paidAmountIdr: number;
  forceRefunded?: boolean;
}): PaymentStatus {
  if (input.forceRefunded) {
    return PaymentStatus.REFUNDED;
  }
  if (input.totalAmountIdr == null) {
    return PaymentStatus.UNPAID;
  }
  if (input.totalAmountIdr === 0 && input.paidAmountIdr === 0) {
    return PaymentStatus.PAID;
  }
  if (input.paidAmountIdr <= 0) {
    return PaymentStatus.UNPAID;
  }
  if (input.paidAmountIdr < input.totalAmountIdr) {
    return PaymentStatus.DEPOSIT;
  }
  return PaymentStatus.PAID;
}

/** `null` when total unknown; else max(total − paid, 0). */
export function balanceDueIdr(
  totalAmountIdr: number | null,
  paidAmountIdr: number,
): number | null {
  if (totalAmountIdr == null) {
    return null;
  }
  return Math.max(totalAmountIdr - paidAmountIdr, 0);
}

/**
 * Excess already collected above Total (shrink / overpay).
 * `null` when total unknown; else max(paid − total, 0). Desk refunds via Collect.
 */
export function refundDueIdr(
  totalAmountIdr: number | null,
  paidAmountIdr: number,
): number | null {
  if (totalAmountIdr == null) {
    return null;
  }
  return Math.max(paidAmountIdr - totalAmountIdr, 0);
}

/**
 * Desk stay quote from rack rate (design §6 extend/shrink).
 * `nights × defaultPriceIdr` — whole IDR. Returns `null` if nights or rack invalid.
 */
export function suggestStayTotalIdr(
  nights: number,
  defaultPriceIdr: number,
): number | null {
  if (
    !Number.isFinite(nights) ||
    nights < 1 ||
    !Number.isFinite(defaultPriceIdr) ||
    defaultPriceIdr < 0
  ) {
    return null;
  }
  return Math.floor(nights) * Math.floor(defaultPriceIdr);
}

/**
 * Confirm / create-as-CONFIRMED field matrix (design §7).
 * Shared FE + BE — incomplete Confirm must not invent stub guest/money.
 */
export type ConfirmFieldGap =
  | 'unit'
  | 'dates'
  | 'guestName'
  | 'guestContact'
  | 'guestCount'
  | 'totalAmountIdr'
  | 'paidAmountIdr';

export type ConfirmReadinessInput = {
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCount: number | null;
  totalAmountIdr: number | null;
  paidAmountIdr: number;
  /** When known, guestCount must be <= maxGuests. */
  maxGuests?: number | null;
};

/** True when name is empty or still an iCal placeholder (doc: reject `*(iCal)`). */
export function isPlaceholderGuestName(guestName: string): boolean {
  const name = guestName.trim();
  if (!name) {
    return true;
  }
  return /\(iCal\)\s*$/i.test(name);
}

/** Gaps that block Confirm / CONFIRMED create. Empty = ready. */
export function getConfirmFieldGaps(
  input: ConfirmReadinessInput,
): ConfirmFieldGap[] {
  const gaps: ConfirmFieldGap[] = [];

  if (!input.unitId.trim()) {
    gaps.push('unit');
  }
  if (
    !input.checkInDate ||
    !input.checkOutDate ||
    input.checkOutDate <= input.checkInDate
  ) {
    gaps.push('dates');
  }
  if (isPlaceholderGuestName(input.guestName)) {
    gaps.push('guestName');
  }
  const email = input.guestEmail?.trim() ?? '';
  const phone = input.guestPhone?.trim() ?? '';
  if (!email && !phone) {
    gaps.push('guestContact');
  }
  if (
    input.guestCount == null ||
    !Number.isInteger(input.guestCount) ||
    input.guestCount < 1
  ) {
    gaps.push('guestCount');
  } else if (
    input.maxGuests != null &&
    input.guestCount > input.maxGuests
  ) {
    gaps.push('guestCount');
  }
  if (input.totalAmountIdr == null || input.totalAmountIdr < 0) {
    gaps.push('totalAmountIdr');
  }
  if (input.paidAmountIdr < 0) {
    gaps.push('paidAmountIdr');
  }

  return gaps;
}

export function isReadyToConfirm(input: ConfirmReadinessInput): boolean {
  return getConfirmFieldGaps(input).length === 0;
}

/**
 * Staff/PMS wire shape for a reservation.
 * `unitCode` / `propertyName` are denormalized for list/detail display.
 * Dates are `YYYY-MM-DD` (check-in inclusive, check-out exclusive).
 */
export type StaffReservation = {
  id: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitCode: string;
  unitTypeId: string;
  source: ReservationSource;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCount: number | null;
  notes: string | null;
  totalAmountIdr: number | null;
  /** Denormalized cache = sum(PaymentMovement.signedAmount). */
  paidAmountIdr: number;
  paymentStatus: PaymentStatus;
  collectedVia: CollectedVia | null;
  externalRef: string | null;
  icalSyncWarning: IcalSyncWarning | null;
  icalSyncWarnedAt: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Cash timeline (newest-last in storage; UI sorts newest-first).
   * List endpoints may omit; detail should include.
   */
  movements?: PaymentMovement[];
};
