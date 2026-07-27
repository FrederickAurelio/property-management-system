import {
  CollectedVia,
  IcalSyncWarning,
  PaymentMovementDirection,
  PaymentMovementKind,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  StayBillingPeriod,
  balanceDueIdr,
  getConfirmFieldGaps,
  isReadyToConfirm,
  periodCountFromRange,
  refundDueIdr,
  todayYmdInTimezone,
  type ConfirmFieldGap,
  type PaymentMovement,
  type StaffReservation,
} from "@cabin/api-contract";
import { formatIdr } from "@/pages/properties/inventory-types";

export {
  formatIdr,
  balanceDueIdr,
  isReadyToConfirm,
  refundDueIdr,
  todayYmdInTimezone,
  StayBillingPeriod,
};

const mediumDateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

export function formatDateYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    return ymd;
  }
  return mediumDateFormat.format(new Date(y, m - 1, d));
}

/** Inclusive check-in → exclusive check-out as a readable range + period count. */
export function formatStayRange(
  checkInDate: string,
  checkOutDate: string,
  billingPeriod: StayBillingPeriod = StayBillingPeriod.DAILY,
): string {
  const count = periodCountFromRange(billingPeriod, checkInDate, checkOutDate);
  const nights = nightCount(checkInDate, checkOutDate);
  let periodLabel: string;
  if (billingPeriod === StayBillingPeriod.MONTHLY && count != null) {
    periodLabel = count === 1 ? "1 month" : `${count} months`;
  } else if (billingPeriod === StayBillingPeriod.YEARLY && count != null) {
    periodLabel = count === 1 ? "1 year" : `${count} years`;
  } else {
    periodLabel = nights === 1 ? "1 night" : `${nights} nights`;
  }
  const suffix =
    billingPeriod !== StayBillingPeriod.DAILY && count != null
      ? ` · ${nights} nights`
      : "";
  return `${formatDateYmd(checkInDate)} → ${formatDateYmd(checkOutDate)} · ${periodLabel}${suffix}`;
}

export function nightCount(checkInDate: string, checkOutDate: string): number {
  const [y1, m1, d1] = checkInDate.split("-").map(Number);
  const [y2, m2, d2] = checkOutDate.split("-").map(Number);
  const a = Date.UTC(y1!, m1! - 1, d1!);
  const b = Date.UTC(y2!, m2! - 1, d2!);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Browser-local today — prefer `todayYmdInTimezone(propertyTimezone)` for ops. */
export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when check-in is allowed without confirmEarly (doc §5 window). */
export function isCheckInWindow(
  row: Pick<StaffReservation, "checkInDate" | "checkOutDate">,
  today: string,
): boolean {
  return row.checkInDate <= today && today < row.checkOutDate;
}

/** Overdue desk cues — independent of which board the row appears on. */
export type ReservationLateCue = "arrival" | "departure";

export function reservationLateCue(
  row: Pick<
    StaffReservation,
    "status" | "checkInDate" | "checkOutDate" | "propertyTimezone"
  >,
): ReservationLateCue | null {
  const today = todayYmdInTimezone(row.propertyTimezone);
  if (
    row.status === ReservationStatus.CONFIRMED &&
    row.checkInDate < today &&
    today < row.checkOutDate
  ) {
    return "arrival";
  }
  if (
    row.status === ReservationStatus.CHECKED_IN &&
    row.checkOutDate < today
  ) {
    return "departure";
  }
  return null;
}

export function formatReservationLateCue(cue: ReservationLateCue): string {
  return cue === "arrival" ? "Late arrival" : "Late departure";
}

export function formatReservationStatus(status: ReservationStatus): string {
  switch (status) {
    case ReservationStatus.UNCONFIRMED:
      return "Needs details";
    case ReservationStatus.CONFIRMED:
      return "Confirmed";
    case ReservationStatus.CHECKED_IN:
      return "In-house";
    case ReservationStatus.CHECKED_OUT:
      return "Checked out";
    case ReservationStatus.CANCELLED:
      return "Cancelled";
  }
}

export function formatReservationSource(source: ReservationSource): string {
  switch (source) {
    case ReservationSource.MANUAL:
      return "Manual";
    case ReservationSource.WEBSITE:
      return "Website";
    case ReservationSource.BOOKING_COM:
      return "Booking.com";
    case ReservationSource.AIRBNB:
      return "Airbnb";
    case ReservationSource.AGODA:
      return "Agoda";
  }
}

export function formatPaymentStatus(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.UNPAID:
      return "Unpaid";
    case PaymentStatus.DEPOSIT:
      return "Deposit";
    case PaymentStatus.PAID:
      return "Paid";
    case PaymentStatus.REFUNDED:
      return "Refunded";
  }
}

export function formatIcalWarning(warning: IcalSyncWarning): string {
  switch (warning) {
    case IcalSyncWarning.MISSING_FROM_FEED:
      return "Missing from OTA feed";
    case IcalSyncWarning.DATES_DIFFER:
      return "OTA dates differ";
    case IcalSyncWarning.OTA_STILL_LISTED:
      return "OTA still lists this booking";
    case IcalSyncWarning.IMPORT_OVERLAP:
      return "OTA booking overlaps another stay";
    case IcalSyncWarning.UNIT_DIFFER:
      return "OTA lists on another unit";
  }
}

export function formatMoneyOrDash(amount: number | null): string {
  if (amount == null) {
    return "—";
  }
  return formatIdr(amount);
}

export function reservationDue(
  row: Pick<StaffReservation, "totalAmountIdr" | "paidAmountIdr">,
): number | null {
  return balanceDueIdr(row.totalAmountIdr, row.paidAmountIdr);
}

/** Excess Paid above Total (shrink / overpay) — settle with Refund. */
export function reservationRefund(
  row: Pick<StaffReservation, "totalAmountIdr" | "paidAmountIdr">,
): number | null {
  return refundDueIdr(row.totalAmountIdr, row.paidAmountIdr);
}

/**
 * Open money gap: Due when guest owes, Refund when overpaid, else settled.
 * Prefer Refund when refund > 0.
 */
export function reservationBalance(
  row: Pick<StaffReservation, "totalAmountIdr" | "paidAmountIdr">,
): {
  amount: number | null;
  kind: "due" | "refund" | "settled";
} {
  const refund = reservationRefund(row);
  if (refund != null && refund > 0) {
    return { amount: refund, kind: "refund" };
  }
  const due = reservationDue(row);
  if (due != null && due > 0) {
    return { amount: due, kind: "due" };
  }
  if (due == null) {
    return { amount: null, kind: "settled" };
  }
  return { amount: 0, kind: "settled" };
}

/** Desk cell copy — Due / Refund for live money; cancelled is closed (no collect). */
export function formatReservationBalanceCell(
  row: Pick<
    StaffReservation,
    "status" | "totalAmountIdr" | "paidAmountIdr"
  >,
): {
  text: string;
  kind: "due" | "refund" | "settled" | "closed";
} {
  if (row.status === ReservationStatus.CANCELLED) {
    return { text: "—", kind: "closed" };
  }
  const balance = reservationBalance(row);
  if (balance.kind === "refund") {
    return {
      text: `Refund ${formatMoneyOrDash(balance.amount)}`,
      kind: "refund",
    };
  }
  if (balance.kind === "due") {
    return {
      text: `Due ${formatMoneyOrDash(balance.amount)}`,
      kind: "due",
    };
  }
  return {
    text: formatMoneyOrDash(balance.amount),
    kind: "settled",
  };
}

export function formatPaymentMovementKind(kind: PaymentMovementKind): string {
  switch (kind) {
    case PaymentMovementKind.DEPOSIT:
      return "Deposit";
    case PaymentMovementKind.TOP_UP:
      return "Top-up";
    case PaymentMovementKind.REFUND:
      return "Refund";
    case PaymentMovementKind.CANCEL_REFUND:
      return "Cancel refund";
    case PaymentMovementKind.CHANNEL_SETTLED:
      return "Channel settled";
  }
}

export function formatCollectedVia(via: CollectedVia | null): string | null {
  if (via == null) {
    return null;
  }
  switch (via) {
    case CollectedVia.PROPERTY:
      return "Property";
    case CollectedVia.CHANNEL:
      return "Channel";
    case CollectedVia.MIXED:
      return "Mixed";
  }
}

export function formatPaymentMovementSigned(m: PaymentMovement): string {
  const sign =
    m.direction === PaymentMovementDirection.IN ? "+" : "−";
  return `${sign}${formatIdr(m.amountIdr)}`;
}

const movementTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatMovementCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return movementTimeFormat.format(d);
}

/** Newest first for desk timeline. */
export function movementsNewestFirst(
  movements: PaymentMovement[] | undefined,
): PaymentMovement[] {
  if (!movements?.length) {
    return [];
  }
  return [...movements].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

export type BadgeTone = "default" | "muted" | "warn" | "danger" | "ok";

export function statusBadgeTone(status: ReservationStatus): BadgeTone {
  switch (status) {
    case ReservationStatus.UNCONFIRMED:
      return "warn";
    case ReservationStatus.CONFIRMED:
      return "default";
    case ReservationStatus.CHECKED_IN:
      return "ok";
    case ReservationStatus.CHECKED_OUT:
      return "muted";
    case ReservationStatus.CANCELLED:
      return "muted";
  }
}

export function paymentBadgeTone(status: PaymentStatus): BadgeTone {
  switch (status) {
    case PaymentStatus.UNPAID:
      return "danger";
    case PaymentStatus.DEPOSIT:
      return "warn";
    case PaymentStatus.PAID:
      return "ok";
    case PaymentStatus.REFUNDED:
      return "muted";
  }
}

/** Primary action for detail — null when none (terminal or gated). */
export type PrimaryAction = "confirm" | "check-in" | "check-out";

export function primaryActionFor(row: StaffReservation): PrimaryAction | null {
  switch (row.status) {
    case ReservationStatus.UNCONFIRMED:
      return "confirm";
    case ReservationStatus.CONFIRMED:
      // Early check-in allowed with confirm when checkInDate > today.
      return "check-in";
    case ReservationStatus.CHECKED_IN:
      // Desk-friendly: allow check-out (incl. early / late) — dates unchanged.
      return "check-out";
    default:
      return null;
  }
}

export function isTerminalStatus(status: ReservationStatus): boolean {
  return (
    status === ReservationStatus.CHECKED_OUT ||
    status === ReservationStatus.CANCELLED
  );
}

/** Dates / unit / guest edits — locked once the stay is closed. */
export function canEditStay(status: ReservationStatus): boolean {
  return !isTerminalStatus(status);
}

/**
 * Cash Collect / Refund sheet — only when money is still open.
 *
 * - Cancelled: closed (disposition already chosen).
 * - Live + checked-out: open only if Due > 0 (collect) or Refund > 0 (return).
 * - Settled (Due = 0 and Refund = 0): no button — nothing to do.
 */
export function canCollectPayment(row: StaffReservation): boolean {
  if (row.status === ReservationStatus.CANCELLED) {
    return false;
  }
  const due = reservationDue(row);
  const refund = reservationRefund(row);
  return (due != null && due > 0) || (refund != null && refund > 0);
}

/** Detail CTA label: Collect (guest owes) vs Refund (property owes). */
export function collectPaymentLabel(row: StaffReservation): "Collect" | "Refund" {
  const refund = reservationRefund(row);
  if (refund != null && refund > 0) {
    return "Refund";
  }
  return "Collect";
}

export function primaryActionLabel(action: PrimaryAction): string {
  switch (action) {
    case "confirm":
      return "Confirm";
    case "check-in":
      return "Check in";
    case "check-out":
      return "Check out";
  }
}

/** Solid CTA colors so desk ops are distinguishable at a glance. */
export function primaryActionButtonClass(action: PrimaryAction): string {
  switch (action) {
    case "confirm":
      return "";
    case "check-in":
      return "border-transparent bg-emerald-700 text-white hover:bg-emerald-700/90 focus-visible:border-emerald-700/40 focus-visible:ring-emerald-700/30 dark:bg-emerald-600 dark:hover:bg-emerald-600/90";
    case "check-out":
      return "border-transparent bg-sky-700 text-white hover:bg-sky-700/90 focus-visible:border-sky-700/40 focus-visible:ring-sky-700/30 dark:bg-sky-600 dark:hover:bg-sky-600/90";
  }
}

export function confirmReadinessFromReservation(row: StaffReservation) {
  return getConfirmFieldGaps({
    unitId: row.unitId,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    guestCount: row.guestCount,
    totalAmountIdr: row.totalAmountIdr,
    paidAmountIdr: row.paidAmountIdr,
  });
}

export function formatConfirmFieldGap(gap: ConfirmFieldGap): string {
  switch (gap) {
    case "unit":
      return "unit";
    case "dates":
      return "stay dates";
    case "guestName":
      return "real guest name";
    case "guestContact":
      return "phone or email";
    case "guestCount":
      return "guest count";
    case "totalAmountIdr":
      return "total amount";
    case "paidAmountIdr":
      return "paid amount";
  }
}

export function formatConfirmGapsMessage(gaps: ConfirmFieldGap[]): string {
  if (gaps.length === 0) {
    return "";
  }
  const labels = gaps.map(formatConfirmFieldGap);
  if (labels.length === 1) {
    return `Add ${labels[0]} before confirming.`;
  }
  const head = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1];
  return `Add ${head}, and ${last} before confirming.`;
}
