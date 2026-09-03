import {
  CollectedVia,
  PaymentMovementDirection,
  PaymentMovementKind,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  StayBillingPeriod,
  balanceDueIdr,
  getConfirmFieldGaps,
  isReadyToConfirm,
  moneyGapKind,
  periodCountFromRange,
  refundDueIdr,
  todayYmdInTimezone,
  type ConfirmFieldGap,
  type IcalSyncWarning,
  type PaymentMovement,
  type ReservationSource as ReservationSourceType,
  type StaffReservation,
  type StaffReservationListItem,
} from "@cabin/api-contract";
import i18n from "@/i18n";
import { formatIdr } from "@/pages/properties/inventory-types";
import { icalWarningTitle } from "./ical-playbooks";

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

function periodUnitKey(
  billingPeriod: StayBillingPeriod,
): "month" | "year" | "night" {
  if (billingPeriod === StayBillingPeriod.MONTHLY) {
    return "month";
  }
  if (billingPeriod === StayBillingPeriod.YEARLY) {
    return "year";
  }
  return "night";
}

/** Inclusive check-in → exclusive check-out as a readable range + period count. */
export function formatStayRange(
  checkInDate: string,
  checkOutDate: string,
  billingPeriod: StayBillingPeriod = StayBillingPeriod.DAILY,
): string {
  const count = periodCountFromRange(billingPeriod, checkInDate, checkOutDate);
  const nights = nightCount(checkInDate, checkOutDate);
  const unit = periodUnitKey(billingPeriod);
  const periodLabel =
    unit === "night" || count == null
      ? i18n.t("reservations:format.units.night", { count: nights })
      : i18n.t(`reservations:format.units.${unit}`, { count });
  const suffix =
    unit !== "night" && count != null
      ? ` · ${i18n.t("reservations:format.units.night", { count: nights })}`
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
  if (row.status === ReservationStatus.CHECKED_IN && row.checkOutDate < today) {
    return "departure";
  }
  return null;
}

export function formatReservationLateCue(cue: ReservationLateCue): string {
  return cue === "arrival"
    ? i18n.t("reservations:format.lateArrival")
    : i18n.t("reservations:format.lateDeparture");
}

/**
 * Soft desk cue for the Utilities due board — meter readings are due next month.
 * Returns `null` when nothing is flagged (rendering is gated on `utilitiesDueNotice`).
 */
export function formatUtilitiesDueCue(
  row: Pick<StaffReservationListItem, "utilitiesNextDueDate">,
): string {
  if (!row.utilitiesNextDueDate) {
    return i18n.t("reservations:format.utilitiesDue");
  }
  return i18n.t("reservations:format.utilitiesDueBy", {
    date: formatDateYmd(row.utilitiesNextDueDate),
  });
}

export function formatReservationStatus(status: ReservationStatus): string {
  switch (status) {
    case ReservationStatus.UNCONFIRMED:
      return i18n.t("reservations:format.status.unconfirmed");
    case ReservationStatus.CONFIRMED:
      return i18n.t("reservations:format.status.confirmed");
    case ReservationStatus.CHECKED_IN:
      return i18n.t("reservations:format.status.checkedIn");
    case ReservationStatus.CHECKED_OUT:
      return i18n.t("reservations:format.status.checkedOut");
    case ReservationStatus.CANCELLED:
      return i18n.t("reservations:format.status.cancelled");
  }
}

export function formatReservationSource(source: ReservationSource): string {
  switch (source) {
    case ReservationSource.MANUAL:
      return i18n.t("reservations:format.source.manual");
    case ReservationSource.WEBSITE:
      return i18n.t("reservations:format.source.website");
    case ReservationSource.BOOKING_COM:
      return i18n.t("reservations:format.source.bookingCom");
    case ReservationSource.AIRBNB:
      return i18n.t("reservations:format.source.airbnb");
    case ReservationSource.AGODA:
      return i18n.t("reservations:format.source.agoda");
  }
}

export function formatPaymentStatus(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.UNPAID:
      return i18n.t("reservations:format.paymentStatus.unpaid");
    case PaymentStatus.DEPOSIT:
      return i18n.t("reservations:format.paymentStatus.deposit");
    case PaymentStatus.PAID:
      return i18n.t("reservations:format.paymentStatus.paid");
    case PaymentStatus.REFUNDED:
      return i18n.t("reservations:format.paymentStatus.refunded");
  }
}

export function formatIcalWarning(
  warning: IcalSyncWarning,
  source?: ReservationSourceType | null,
): string {
  return icalWarningTitle(warning, source);
}

export function formatMoneyOrDash(amount: number | null): string {
  if (amount == null) {
    return i18n.t("reservations:format.moneyDash");
  }
  return formatIdr(amount);
}

export function reservationDue(
  row: Pick<StaffReservation, "totalAmountIdr" | "paidAmountIdr">,
): number | null {
  return balanceDueIdr(row.totalAmountIdr, row.paidAmountIdr);
}

/** Excess Paid above Total (utilities deposit / overpay / shrink). */
export function reservationRefund(
  row: Pick<StaffReservation, "totalAmountIdr" | "paidAmountIdr">,
): number | null {
  return refundDueIdr(row.totalAmountIdr, row.paidAmountIdr);
}

/**
 * Open money gap: Due when guest owes, Credit while live excess sits,
 * Refund after checkout, else settled.
 */
export function reservationBalance(
  row: Pick<StaffReservation, "status" | "totalAmountIdr" | "paidAmountIdr">,
): {
  amount: number | null;
  kind: "due" | "credit" | "refund" | "settled";
} {
  const kind = moneyGapKind(row);
  if (kind === "refund") {
    return { amount: reservationRefund(row), kind: "refund" };
  }
  if (kind === "credit") {
    return { amount: reservationRefund(row), kind: "credit" };
  }
  const due = reservationDue(row);
  if (kind === "due") {
    return { amount: due, kind: "due" };
  }
  if (due == null) {
    return { amount: null, kind: "settled" };
  }
  return { amount: 0, kind: "settled" };
}

/** Desk cell copy — Due / Credit / Refund; cancelled is closed (no collect). */
export function formatReservationBalanceCell(
  row: Pick<StaffReservation, "status" | "totalAmountIdr" | "paidAmountIdr">,
): {
  text: string;
  kind: "due" | "credit" | "refund" | "settled" | "closed";
} {
  if (row.status === ReservationStatus.CANCELLED) {
    return { text: i18n.t("reservations:format.moneyDash"), kind: "closed" };
  }
  const balance = reservationBalance(row);
  if (balance.kind === "refund") {
    return {
      text: i18n.t("reservations:format.refund", {
        amount: formatMoneyOrDash(balance.amount),
      }),
      kind: "refund",
    };
  }
  if (balance.kind === "credit") {
    return {
      text: i18n.t("reservations:format.credit", {
        amount: formatMoneyOrDash(balance.amount),
      }),
      kind: "credit",
    };
  }
  if (balance.kind === "due") {
    return {
      text: i18n.t("reservations:format.due", {
        amount: formatMoneyOrDash(balance.amount),
      }),
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
      return i18n.t("reservations:format.movementKind.deposit");
    case PaymentMovementKind.TOP_UP:
      return i18n.t("reservations:format.movementKind.topUp");
    case PaymentMovementKind.REFUND:
      return i18n.t("reservations:format.movementKind.refund");
    case PaymentMovementKind.CANCEL_REFUND:
      return i18n.t("reservations:format.movementKind.cancelRefund");
    case PaymentMovementKind.CHANNEL_SETTLED:
      return i18n.t("reservations:format.movementKind.channelSettled");
  }
}

export function formatCollectedVia(via: CollectedVia | null): string | null {
  if (via == null) {
    return null;
  }
  switch (via) {
    case CollectedVia.PROPERTY:
      return i18n.t("reservations:format.collectedVia.property");
    case CollectedVia.CHANNEL:
      return i18n.t("reservations:format.collectedVia.channel");
    case CollectedVia.MIXED:
      return i18n.t("reservations:format.collectedVia.mixed");
  }
}

export function formatPaymentMovementSigned(m: PaymentMovement): string {
  const sign = m.direction === PaymentMovementDirection.IN ? "+" : "−";
  return `${sign}${formatIdr(m.amountIdr)}`;
}

function movementTimeFormat(timezone?: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  if (timezone) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        ...options,
        timeZone: timezone,
      });
    } catch {
      // Invalid IANA — mirror api-contract ymdInTimezone fallback behavior.
    }
  }
  return new Intl.DateTimeFormat(undefined, options);
}

export function formatMovementCreatedAt(
  iso: string,
  timezone?: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return movementTimeFormat(timezone).format(d);
}

/** Newest first for desk timeline. Ties break on id desc (same as Nest undo latest). */
export function movementsNewestFirst(
  movements: PaymentMovement[] | undefined,
): PaymentMovement[] {
  if (!movements?.length) {
    return [];
  }
  return [...movements].sort((a, b) => {
    if (a.createdAt < b.createdAt) {
      return 1;
    }
    if (a.createdAt > b.createdAt) {
      return -1;
    }
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

export function formatUndoRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

/** Dates / unit / guest edits — locked once cancelled. */
export function canEditStay(status: ReservationStatus): boolean {
  return status !== ReservationStatus.CANCELLED;
}

/** Cancel sheet — not available on terminal stays. */
export function canCancelStay(status: ReservationStatus): boolean {
  return !isTerminalStatus(status);
}

/**
 * Collect sheet — any non-cancelled stay with Total set (no Due/Refund gate).
 * Extra cash is credit until checkout.
 */
export function canCollectPayment(row: StaffReservation): boolean {
  return (
    row.status !== ReservationStatus.CANCELLED && row.totalAmountIdr != null
  );
}

/** Refund sheet — excess above Total; cancelled stays use the Cancel sheet. */
export function canRefundPayment(row: StaffReservation): boolean {
  if (row.status === ReservationStatus.CANCELLED) {
    return false;
  }
  const refund = reservationRefund(row);
  return refund != null && refund > 0;
}

export function primaryActionLabel(action: PrimaryAction): string {
  switch (action) {
    case "confirm":
      return i18n.t("reservations:format.primaryAction.confirm");
    case "check-in":
      return i18n.t("reservations:format.primaryAction.checkIn");
    case "check-out":
      return i18n.t("reservations:format.primaryAction.checkOut");
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
    rentAmountIdr: row.rentAmountIdr ?? row.totalAmountIdr,
    paidAmountIdr: row.paidAmountIdr,
  });
}

export function formatConfirmFieldGap(gap: ConfirmFieldGap): string {
  switch (gap) {
    case "unit":
      return i18n.t("reservations:format.confirmGap.unit");
    case "dates":
      return i18n.t("reservations:format.confirmGap.dates");
    case "guestName":
      return i18n.t("reservations:format.confirmGap.guestName");
    case "guestContact":
      return i18n.t("reservations:format.confirmGap.guestContact");
    case "guestCount":
      return i18n.t("reservations:format.confirmGap.guestCount");
    case "rentAmountIdr":
      return i18n.t("reservations:format.confirmGap.rentAmountIdr");
    case "paidAmountIdr":
      return i18n.t("reservations:format.confirmGap.paidAmountIdr");
  }
}

export function formatConfirmGapsMessage(gaps: ConfirmFieldGap[]): string {
  if (gaps.length === 0) {
    return "";
  }
  const labels = gaps.map(formatConfirmFieldGap);
  if (labels.length === 1) {
    return i18n.t("reservations:format.confirmGapsMessageOne", {
      item: labels[0],
    });
  }
  const head = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1];
  return i18n.t("reservations:format.confirmGapsMessageMany", {
    items: head,
    last,
  });
}
