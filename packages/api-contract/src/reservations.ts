/** Keep in sync with Prisma `ReservationSource` (when added). */
import type { ArchiveItem } from './archive.js';

export const ReservationSource = {
  MANUAL: "MANUAL",
  WEBSITE: "WEBSITE",
  BOOKING_COM: "BOOKING_COM",
  AIRBNB: "AIRBNB",
  AGODA: "AGODA",
} as const;

export type ReservationSource =
  (typeof ReservationSource)[keyof typeof ReservationSource];

/** Keep in sync with Prisma `ReservationStatus` (when added). */
export const ReservationStatus = {
  UNCONFIRMED: "UNCONFIRMED",
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED_IN",
  CHECKED_OUT: "CHECKED_OUT",
  CANCELLED: "CANCELLED",
} as const;

export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

/** Occupying statuses — block the unit calendar (unless icalOverlapHold). */
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

/** True when the stay blocks calendar / export / overlap (status occupying and not an import hold). */
export function isCalendarOccupying(row: {
  status: ReservationStatus;
  icalOverlapHold?: boolean;
}): boolean {
  return isOccupyingReservationStatus(row.status) && !row.icalOverlapHold;
}

/** Desk meaning: what the guest still owes at the property. */
export const PaymentStatus = {
  UNPAID: "UNPAID",
  DEPOSIT: "DEPOSIT",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const CollectedVia = {
  PROPERTY: "PROPERTY",
  CHANNEL: "CHANNEL",
  MIXED: "MIXED",
} as const;

export type CollectedVia = (typeof CollectedVia)[keyof typeof CollectedVia];

/** Cash movement direction — property money in / out (design §6). */
export const PaymentMovementDirection = {
  IN: "IN",
  OUT: "OUT",
} as const;

export type PaymentMovementDirection =
  (typeof PaymentMovementDirection)[keyof typeof PaymentMovementDirection];

/**
 * Why cash moved. Quote (Total) edits are not movements.
 * Nest persists the same kinds when `/staff/reservations` lands.
 */
export const PaymentMovementKind = {
  DEPOSIT: "DEPOSIT",
  TOP_UP: "TOP_UP",
  REFUND: "REFUND",
  CANCEL_REFUND: "CANCEL_REFUND",
  CHANNEL_SETTLED: "CHANNEL_SETTLED",
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
  /** Session admin who posted the line; null for system/seed. */
  createdByAdminId: string | null;
  /** Denormalized for timeline display (same idea as `propertyName`). */
  createdByAdminUsername: string | null;
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
  movements: ReadonlyArray<Pick<PaymentMovement, "signedAmount">>,
): number {
  let sum = 0;
  for (const m of movements) {
    sum += m.signedAmount;
  }
  return Math.max(0, sum);
}

export const IcalSyncWarning = {
  MISSING_FROM_FEED: "MISSING_FROM_FEED",
  DATES_DIFFER: "DATES_DIFFER",
  OTA_STILL_LISTED: "OTA_STILL_LISTED",
  IMPORT_OVERLAP: "IMPORT_OVERLAP",
  /** OTA UID found on another unit’s same-source feed — staff Accept move. */
  UNIT_DIFFER: "UNIT_DIFFER",
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

/** Fallback IANA zone when property timezone is missing (matches API desk default). */
export const DEFAULT_PROPERTY_TIMEZONE = 'Asia/Jakarta';

/** Property-local calendar date as YYYY-MM-DD (desk boards / check-in window). */
export function todayYmdInTimezone(timezone: string, now = new Date()): string {
  return ymdInTimezone(now, timezone);
}

/** Instant → YYYY-MM-DD in an IANA timezone (iCal DATE-TIME import). */
export function ymdInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

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
 * Open chase amount for desk sort / dashboard Needs attention.
 * `max(Due, Refund)`; `0` when Total unknown (same as treating both as null).
 */
export function openAmountIdr(
  totalAmountIdr: number | null,
  paidAmountIdr: number,
): number {
  const due = balanceDueIdr(totalAmountIdr, paidAmountIdr) ?? 0;
  const refund = refundDueIdr(totalAmountIdr, paidAmountIdr) ?? 0;
  return Math.max(due, refund);
}

/**
 * Desk stay quote from rack rate (design §6 extend/shrink).
 * `periodCount × unitPriceIdr` (nights / months / years) — whole IDR.
 * Returns `null` if count or rack invalid.
 */
export function suggestStayTotalIdr(
  periodCount: number,
  unitPriceIdr: number,
): number | null {
  if (
    !Number.isFinite(periodCount) ||
    periodCount < 1 ||
    !Number.isFinite(unitPriceIdr) ||
    unitPriceIdr < 0
  ) {
    return null;
  }
  return Math.floor(periodCount) * Math.floor(unitPriceIdr);
}

/** Keep in sync with Prisma `UtilityKind`. */
export const UtilityKind = {
  ELECTRICITY: "ELECTRICITY",
  WATER: "WATER",
} as const;

export type UtilityKind = (typeof UtilityKind)[keyof typeof UtilityKind];

export type ReservationUtilityReading = {
  id: string;
  reservationId: string;
  utility: UtilityKind;
  /** YYYY-MM-DD */
  readingDate: string;
  meterValue: number;
  /** Garage meteran proof photos for this reading. */
  proofImages: ArchiveItem[];
  createdAt: string;
  createdByAdminId: string | null;
};

export type ReservationMaintenanceCharge = {
  id: string;
  reservationId: string;
  /** Canonical 1st of month (`YYYY-MM-01`); desk shows month+year only. */
  chargeDate: string;
  amountIdr: number;
  createdAt: string;
  createdByAdminId: string | null;
};

export type StayQuoteBreakdown = {
  rentAmountIdr: number | null;
  electricityAmountIdr: number;
  waterAmountIdr: number;
  maintenanceAmountIdr: number;
  totalAmountIdr: number | null;
};

/** Input row for replace-set utilities (no id — BE assigns). */
export type UtilityReadingInput = {
  utility: UtilityKind;
  readingDate: string;
  meterValue: number;
  /** Garage meteran proof photos (optional back-compat). */
  proofImages?: ArchiveItem[];
};

export type MaintenanceChargeInput = {
  /** Full YMD; Nest normalizes to 1st of that calendar month. Desk sends `YYYY-MM-01`. */
  chargeDate: string;
  amountIdr: number;
};

export type PutReservationUtilitiesInput = {
  electricityRateIdrPerKwh?: number;
  waterRateIdrPerM3?: number;
  maintenanceFeeIdrPerMonth?: number;
  electricityReadings: UtilityReadingInput[];
  waterReadings: UtilityReadingInput[];
  maintenanceCharges: MaintenanceChargeInput[];
};

/**
 * First day of `ymd`'s calendar month.
 * `2026-05-10` → `2026-05-01`.
 */
export function firstDayOfMonthYmd(ymd: string): string {
  const parts = parseYmdParts(ymd);
  if (!parts) {
    return ymd;
  }
  return formatYmd(parts.y, parts.m, 1);
}

/**
 * First day of the calendar month after `ymd`'s month.
 * `2026-05-10` → `2026-06-01`.
 */
export function firstDayOfNextMonthYmd(ymd: string): string {
  const parts = parseYmdParts(ymd);
  if (!parts) {
    return ymd;
  }
  const totalMonths = parts.y * 12 + (parts.m - 1) + 1;
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  return formatYmd(y, m, 1);
}

/**
 * First maintenance charge date for a stay (IPL-style calendar month).
 * Desk UI is month+year; storage is always the 1st of that month.
 * Not check-in day — meters use check-in as baseline; maintenance does not.
 * `2026-05-10` → `2026-05-01`.
 */
export function defaultFirstMaintenanceChargeDateYmd(
  checkInYmd: string,
): string {
  return firstDayOfMonthYmd(checkInYmd);
}

/** Default next meter/maintenance row date after the previous row. */
export function defaultNextUtilityReadingDateYmd(previousYmd: string): string {
  return firstDayOfNextMonthYmd(previousYmd);
}

/**
 * Canonical maintenance `chargeDate` from a full YMD or `YYYY-MM`.
 * Always stores the 1st of that calendar month.
 */
export function normalizeMaintenanceChargeDateYmd(ymdOrYm: string): string {
  if (/^\d{4}-\d{2}$/.test(ymdOrYm)) {
    return `${ymdOrYm}-01`;
  }
  return firstDayOfMonthYmd(ymdOrYm);
}

export type MeterIntervalCharge = {
  fromDate: string;
  toDate: string;
  usage: number;
  amountIdr: number;
};

/**
 * Sort readings by date; baseline (first) charges 0.
 * Throws if meter decreases or duplicate dates.
 */
export function computeMeterIntervalCharges(
  readings: ReadonlyArray<{ readingDate: string; meterValue: number }>,
  rateIdrPerUnit: number,
): { totalAmountIdr: number; intervals: MeterIntervalCharge[] } {
  const rate = Math.floor(rateIdrPerUnit);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("INVALID_RATE");
  }
  const sorted = [...readings].sort((a, b) =>
    a.readingDate < b.readingDate ? -1 : a.readingDate > b.readingDate ? 1 : 0,
  );
  const seen = new Set<string>();
  for (const r of sorted) {
    if (seen.has(r.readingDate)) {
      throw new Error("DUPLICATE_READING_DATE");
    }
    seen.add(r.readingDate);
    if (!Number.isFinite(r.meterValue) || r.meterValue < 0) {
      throw new Error("INVALID_METER");
    }
  }
  const intervals: MeterIntervalCharge[] = [];
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const usage = cur.meterValue - prev.meterValue;
    if (usage < 0) {
      throw new Error("METER_DECREASED");
    }
    const amountIdr = Math.floor(usage * rate);
    total += amountIdr;
    intervals.push({
      fromDate: prev.readingDate,
      toDate: cur.readingDate,
      usage,
      amountIdr,
    });
  }
  return { totalAmountIdr: total, intervals };
}

export function sumMaintenanceChargesIdr(
  charges: ReadonlyArray<{ amountIdr: number }>,
): number {
  let sum = 0;
  for (const c of charges) {
    if (!Number.isFinite(c.amountIdr) || c.amountIdr < 0) {
      throw new Error("INVALID_AMOUNT");
    }
    sum += Math.floor(c.amountIdr);
  }
  return sum;
}

/**
 * Cash-facing Total from rent + utility denorms.
 * Null rent → null total (iCal stub). Otherwise sum floors.
 */
export function recomputeStayQuoteTotal(input: {
  rentAmountIdr: number | null;
  electricityAmountIdr: number;
  waterAmountIdr: number;
  maintenanceAmountIdr: number;
}): StayQuoteBreakdown {
  const electricityAmountIdr = Math.max(
    0,
    Math.floor(input.electricityAmountIdr),
  );
  const waterAmountIdr = Math.max(0, Math.floor(input.waterAmountIdr));
  const maintenanceAmountIdr = Math.max(
    0,
    Math.floor(input.maintenanceAmountIdr),
  );
  if (input.rentAmountIdr == null) {
    return {
      rentAmountIdr: null,
      electricityAmountIdr,
      waterAmountIdr,
      maintenanceAmountIdr,
      totalAmountIdr: null,
    };
  }
  const rentAmountIdr = Math.floor(input.rentAmountIdr);
  return {
    rentAmountIdr,
    electricityAmountIdr,
    waterAmountIdr,
    maintenanceAmountIdr,
    totalAmountIdr:
      rentAmountIdr +
      electricityAmountIdr +
      waterAmountIdr +
      maintenanceAmountIdr,
  };
}

export function maxYmd(dates: ReadonlyArray<string>): string | null {
  let max: string | null = null;
  for (const d of dates) {
    if (!parseYmdParts(d)) {
      continue;
    }
    if (max == null || d > max) {
      max = d;
    }
  }
  return max;
}

/** YYYY-MM of a YMD string, or null if invalid. */
export function ymdYearMonth(ymd: string): string | null {
  const parts = parseYmdParts(ymd);
  if (!parts) {
    return null;
  }
  return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}`;
}

/** `YYYY-MM` → storage YMD on the 1st (`2026-05` → `2026-05-01`). */
export function yearMonthToChargeDateYmd(yearMonth: string): string {
  return normalizeMaintenanceChargeDateYmd(yearMonth);
}

/** First maintenance month for a stay (`2026-05-10` → `2026-05`). */
export function defaultFirstMaintenanceChargeYearMonth(
  checkInYmd: string,
): string {
  return (
    ymdYearMonth(defaultFirstMaintenanceChargeDateYmd(checkInYmd)) ??
    checkInYmd.slice(0, 7)
  );
}

/** Next maintenance month after a `YYYY-MM` row (`2026-05` → `2026-06`). */
export function defaultNextMaintenanceChargeYearMonth(
  previousYearMonth: string,
): string {
  return (
    ymdYearMonth(
      firstDayOfNextMonthYmd(yearMonthToChargeDateYmd(previousYearMonth)),
    ) ?? previousYearMonth
  );
}

/**
 * Whether a billing month `ym` (`YYYY-MM`) is covered by one of each utility:
 * an electricity reading, a water reading, and a maintenance charge in that
 * month. Month-equality (`ymdYearMonth(x) === ym`) for meters and charges.
 */
function utilityMonthCovered(
  ym: string,
  input: {
    electricityReadings: ReadonlyArray<{ readingDate: string }>;
    waterReadings: ReadonlyArray<{ readingDate: string }>;
    maintenanceCharges: ReadonlyArray<{ chargeDate: string }>;
  },
): { elec: boolean; water: boolean; maint: boolean } {
  return {
    elec: input.electricityReadings.some(
      (r) => ymdYearMonth(r.readingDate) === ym,
    ),
    water: input.waterReadings.some(
      (r) => ymdYearMonth(r.readingDate) === ym,
    ),
    maint: input.maintenanceCharges.some(
      (c) => ymdYearMonth(c.chargeDate) === ym,
    ),
  };
}

/**
 * Next utilities due date + soft desk notice (design §6).
 * `todayYmd` = property-local today.
 *
 * Due month = the first month (after the check-in month) that is NOT fully
 * covered by a monthly electricity reading, a water reading, AND a
 * maintenance charge. A partial fill (only one or two recorded) does NOT clear
 * the notice — the month must be fully covered before it advances.
 */
export function computeUtilitiesDueNotice(input: {
  status: ReservationStatus;
  /** Soft notice is MONTHLY/YEARLY only — DAILY stays never flag (desk/dashboard later). */
  billingPeriod: StayBillingPeriod;
  checkInDate: string;
  checkOutDate: string;
  todayYmd: string;
  electricityReadings: ReadonlyArray<{ readingDate: string }>;
  waterReadings: ReadonlyArray<{ readingDate: string }>;
  maintenanceCharges: ReadonlyArray<{ chargeDate: string }>;
}): { utilitiesNextDueDate: string; utilitiesDueNotice: boolean } {
  // First recording/billing cycle = month after check-in month (maintenance
  // is not required for the check-in month itself).
  const firstDueYm = defaultNextMaintenanceChargeYearMonth(
    input.checkInDate.slice(0, 7),
  );
  // Bound the scan by the newest year-month present in the data so a fully
  // covered stay cannot loop forever; a month past every recorded row is not
  // covered by construction.
  const lastObservedYm = maxYmd(
    [
      input.checkInDate,
      input.checkOutDate,
      input.todayYmd,
      ...input.electricityReadings.map((r) => r.readingDate),
      ...input.waterReadings.map((r) => r.readingDate),
      ...input.maintenanceCharges.map((c) => c.chargeDate),
    ]
      .map(ymdYearMonth)
      .filter((m): m is string => m != null),
  );
  let dueYm = firstDueYm;
  let covered = utilityMonthCovered(dueYm, input);
  while (
    covered.elec &&
    covered.water &&
    covered.maint &&
    (lastObservedYm == null || dueYm <= lastObservedYm)
  ) {
    dueYm = defaultNextMaintenanceChargeYearMonth(dueYm);
    covered = utilityMonthCovered(dueYm, input);
  }
  const nextDueDate = yearMonthToChargeDateYmd(dueYm);
  const missingForMonth = !covered.elec || !covered.water || !covered.maint;
  const statusOk =
    input.status === ReservationStatus.CONFIRMED ||
    input.status === ReservationStatus.CHECKED_IN;
  // DAILY may still open the utilities sheet; soft due notice is long-stay only.
  const periodOk =
    input.billingPeriod === "MONTHLY" || input.billingPeriod === "YEARLY";
  const utilitiesDueNotice =
    periodOk &&
    statusOk &&
    input.todayYmd >= nextDueDate &&
    input.todayYmd < input.checkOutDate &&
    missingForMonth;
  return {
    utilitiesNextDueDate: nextDueDate,
    utilitiesDueNotice,
  };
}

/** Stay quote axis — daily rack vs monthly vs yearly. Keep in sync with Prisma. */
export const StayBillingPeriod = {
  DAILY: "DAILY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;

export type StayBillingPeriod =
  (typeof StayBillingPeriod)[keyof typeof StayBillingPeriod];

/**
 * Exclusive inventory end for open-ended MONTHLY/YEARLY holds while occupying.
 * Contract `checkOutDate` stays for money/boards; busy uses this sentinel.
 */
export const INVENTORY_FAR_YMD = "9999-12-31";

/** True when period stays block inventory from check-in until checkout/cancel. */
export function isPeriodOpenInventory(period: StayBillingPeriod): boolean {
  return (
    period === StayBillingPeriod.MONTHLY ||
    period === StayBillingPeriod.YEARLY
  );
}

/**
 * Exclusive inventory busy end for a stay.
 * DAILY → contract `checkOutDate`; MONTHLY/YEARLY → FAR (open hold).
 * Callers snap back to `checkOutDate` on CHECKED_OUT / CANCELLED.
 */
export function computeInventoryEndYmd(
  billingPeriod: StayBillingPeriod,
  checkOutDate: string,
): string {
  return isPeriodOpenInventory(billingPeriod)
    ? INVENTORY_FAR_YMD
    : checkOutDate;
}

/** Max nights for daily billing (~1 year). Enforced in count helpers + picker. */
export const STAY_DAILY_COUNT_MAX = 360;
/** Max periods for monthly billing (10 years). Enforced in count helpers + picker. */
export const STAY_MONTHLY_COUNT_MAX = 120;
/** Max periods for yearly billing. Enforced in count helpers + picker. */
export const STAY_YEARLY_COUNT_MAX = 30;

/** Upper bound for `count` by period. */
export function stayPeriodCountMax(period: StayBillingPeriod): number {
  if (period === StayBillingPeriod.DAILY) {
    return STAY_DAILY_COUNT_MAX;
  }
  if (period === StayBillingPeriod.MONTHLY) {
    return STAY_MONTHLY_COUNT_MAX;
  }
  return STAY_YEARLY_COUNT_MAX;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmdParts(
  ymd: string,
): { y: number; m: number; d: number } | null {
  if (!YMD_RE.test(ymd)) {
    return null;
  }
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return { y, m, d };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Last calendar day of month `m` (1–12) in year `y`. */
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Exclusive check-out = same calendar date + `n` months (EOM clamp when day
 * missing). `26 Jun + 1` → `26 Jul`; `31 Jan + 1` → `28/29 Feb`.
 */
export function addCalendarMonthsYmd(ymd: string, n: number): string {
  const parts = parseYmdParts(ymd);
  if (!parts || !Number.isInteger(n) || n < 0) {
    return ymd;
  }
  const totalMonths = parts.y * 12 + (parts.m - 1) + n;
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  const d = Math.min(parts.d, daysInMonth(y, m));
  return formatYmd(y, m, d);
}

/**
 * Exclusive check-out = same month/day + `n` years (Feb 29 → Feb 28 in
 * non-leap years).
 */
export function addCalendarYearsYmd(ymd: string, n: number): string {
  const parts = parseYmdParts(ymd);
  if (!parts || !Number.isInteger(n) || n < 0) {
    return ymd;
  }
  const y = parts.y + n;
  const d = Math.min(parts.d, daysInMonth(y, parts.m));
  return formatYmd(y, parts.m, d);
}

function nightCountYmd(checkInDate: string, checkOutDate: string): number {
  const a = parseYmdParts(checkInDate);
  const b = parseYmdParts(checkOutDate);
  if (!a || !b) {
    return 0;
  }
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Exclusive check-out from check-in + period count.
 * Daily: +nights days; monthly/yearly: same-date helpers.
 * Over-max count returns `checkInDate` (invalid range).
 */
export function checkoutFromPeriodCount(
  period: StayBillingPeriod,
  checkInDate: string,
  count: number,
): string {
  if (!Number.isInteger(count) || count < 1) {
    return checkInDate;
  }
  const max = stayPeriodCountMax(period);
  if (count > max) {
    return checkInDate;
  }
  if (period === StayBillingPeriod.DAILY) {
    const parts = parseYmdParts(checkInDate);
    if (!parts) {
      return checkInDate;
    }
    const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
    dt.setUTCDate(dt.getUTCDate() + count);
    return formatYmd(
      dt.getUTCFullYear(),
      dt.getUTCMonth() + 1,
      dt.getUTCDate(),
    );
  }
  if (period === StayBillingPeriod.MONTHLY) {
    return addCalendarMonthsYmd(checkInDate, count);
  }
  return addCalendarYearsYmd(checkInDate, count);
}

/**
 * Derive period count from a half-open range. `null` when not a clean
 * boundary for monthly/yearly, over max, or invalid daily range.
 * Monthly/yearly use calendar delta + verify (not a 1…N scan).
 */
export function periodCountFromRange(
  period: StayBillingPeriod,
  checkInDate: string,
  checkOutDate: string,
): number | null {
  const a = parseYmdParts(checkInDate);
  const b = parseYmdParts(checkOutDate);
  if (!a || !b || checkOutDate <= checkInDate) {
    return null;
  }
  if (period === StayBillingPeriod.DAILY) {
    const nights = nightCountYmd(checkInDate, checkOutDate);
    if (nights < 1 || nights > STAY_DAILY_COUNT_MAX) {
      return null;
    }
    return nights;
  }
  if (period === StayBillingPeriod.MONTHLY) {
    const n = (b.y - a.y) * 12 + (b.m - a.m);
    if (n < 1 || n > STAY_MONTHLY_COUNT_MAX) {
      return null;
    }
    if (addCalendarMonthsYmd(checkInDate, n) !== checkOutDate) {
      return null;
    }
    return n;
  }
  const n = b.y - a.y;
  if (n < 1 || n > STAY_YEARLY_COUNT_MAX) {
    return null;
  }
  if (addCalendarYearsYmd(checkInDate, n) !== checkOutDate) {
    return null;
  }
  return n;
}

export function isValidStayPeriodRange(
  period: StayBillingPeriod,
  checkInDate: string,
  checkOutDate: string,
): boolean {
  return periodCountFromRange(period, checkInDate, checkOutDate) != null;
}

/** Rack price for the given billing period. */
export function rackPriceForPeriod(
  period: StayBillingPeriod,
  rack: {
    defaultPriceIdr: number;
    monthlyPriceIdr: number;
    yearlyPriceIdr: number;
  },
): number {
  if (period === StayBillingPeriod.MONTHLY) {
    return rack.monthlyPriceIdr;
  }
  if (period === StayBillingPeriod.YEARLY) {
    return rack.yearlyPriceIdr;
  }
  return rack.defaultPriceIdr;
}

/**
 * Confirm / create-as-CONFIRMED field matrix (design §7).
 * Shared FE + BE — incomplete Confirm must not invent stub guest/money.
 */
export type ConfirmFieldGap =
  | "unit"
  | "dates"
  | "guestName"
  | "guestContact"
  | "guestCount"
  | "rentAmountIdr"
  | "paidAmountIdr";

export type ConfirmReadinessInput = {
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCount: number | null;
  /** Rent quote must be set (≥ 0) before Confirm / CONFIRMED create. */
  rentAmountIdr: number | null;
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
    gaps.push("unit");
  }
  if (
    !input.checkInDate ||
    !input.checkOutDate ||
    input.checkOutDate <= input.checkInDate
  ) {
    gaps.push("dates");
  }
  if (isPlaceholderGuestName(input.guestName)) {
    gaps.push("guestName");
  }
  const email = input.guestEmail?.trim() ?? "";
  const phone = input.guestPhone?.trim() ?? "";
  if (!email && !phone) {
    gaps.push("guestContact");
  }
  if (
    input.guestCount == null ||
    !Number.isInteger(input.guestCount) ||
    input.guestCount < 1
  ) {
    gaps.push("guestCount");
  } else if (input.maxGuests != null && input.guestCount > input.maxGuests) {
    gaps.push("guestCount");
  }
  if (input.rentAmountIdr == null || input.rentAmountIdr < 0) {
    gaps.push("rentAmountIdr");
  }
  if (input.paidAmountIdr < 0) {
    gaps.push("paidAmountIdr");
  }

  return gaps;
}

export function isReadyToConfirm(input: ConfirmReadinessInput): boolean {
  return getConfirmFieldGaps(input).length === 0;
}

/** Cancel money disposition when paid > 0 (design §6). */
export const CancelDisposition = {
  none: "none",
  full_refund: "full_refund",
  keep: "keep",
  partial: "partial",
} as const;

export type CancelDisposition =
  (typeof CancelDisposition)[keyof typeof CancelDisposition];

/**
 * Desk board presets for list filters.
 * `arrivals` = CONFIRMED + checkInDate ≤ today < checkOutDate (overdue inclusive).
 * `departures` = CHECKED_IN + checkOutDate ≤ today (overdue inclusive).
 */
export const ReservationBoard = {
  all: "all",
  arrivals: "arrivals",
  "in-house": "in-house",
  departures: "departures",
  "needs-details": "needs-details",
  "ical-alerts": "ical-alerts",
  "balance-due": "balance-due",
  "utilities-due": "utilities-due",
} as const;

export type ReservationBoard =
  (typeof ReservationBoard)[keyof typeof ReservationBoard];

/** List sort for staff reservation boards (default = checkIn). */
export const ReservationListSort = {
  checkIn: "checkIn",
  createdAt: "createdAt",
  /** Highest open amount first — `max(Due, Refund)`; see `openAmountIdr`. */
  openAmount: "openAmount",
} as const;

export type ReservationListSort =
  (typeof ReservationListSort)[keyof typeof ReservationListSort];

/** Staff list query filters (pagination page/pageSize separate). */
export type StaffReservationListFilters = {
  propertyId?: string;
  q?: string;
  status?: ReservationStatus;
  source?: ReservationSource;
  board?: ReservationBoard;
  /**
   * Default `checkIn` (soonest first). `createdAt` = newest booked first.
   * `openAmount` = highest `max(Due, Refund)` first.
   */
  sort?: ReservationListSort;
  checkInDate?: string;
  checkOutDate?: string;
  /**
   * Inclusive stay-touch window start (YYYY-MM-DD).
   * With `to`: `checkInDate <= to AND checkOutDate >= from`.
   * Without `to`: `checkOutDate >= from` (open-ended).
   * `to` alone is invalid.
   */
  from?: string;
  /** Inclusive stay-touch window end (YYYY-MM-DD). Optional when `from` is set. */
  to?: string;
  /** Exact stay billing period; omit = any. */
  billingPeriod?: StayBillingPeriod;
  hasIcalWarning?: boolean;
  paymentStatusIn?: PaymentStatus[];
  occupyingOnly?: boolean;
};

/** POST /staff/reservations — manual create as CONFIRMED. */
export type CreateStaffReservationInput = {
  propertyId: string;
  unitId: string;
  unitTypeId: string;
  source: ReservationSource;
  billingPeriod: StayBillingPeriod;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestCount: number;
  notes?: string | null;
  /** Rent quote. Nest stores as rentAmountIdr and recomputes Total = rent + utilities. */
  rentAmountIdr: number;
  /** Opening IN DEPOSIT when > 0. */
  depositAmountIdr: number;
};

/** PATCH /staff/reservations/:id — never absolute Paid. */
export type UpdateStaffReservationInput = {
  unitId?: string;
  unitTypeId?: string;
  billingPeriod?: StayBillingPeriod;
  checkInDate?: string;
  checkOutDate?: string;
  guestName?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestCount?: number | null;
  notes?: string | null;
  /** Rent quote — Nest recomputes Total = rent + utilities. */
  rentAmountIdr?: number | null;
  source?: ReservationSource;
};

export type CancelStaffReservationInput = {
  disposition?: CancelDisposition;
  /** OUT amount for partial; required when disposition is partial. */
  refundAmountIdr?: number;
  notes?: string | null;
};

export type PostPaymentMovementInput = {
  direction: PaymentMovementDirection;
  kind: PaymentMovementKind;
  amountIdr: number;
  method?: CollectedVia | null;
  note?: string | null;
};

/** POST check-in / check-out — early stays need confirmEarly. */
export type ConfirmEarlyInput = {
  confirmEarly?: boolean;
};

/**
 * Staff/PMS wire shape for a reservation (detail + mutations).
 * `unitCode` / `propertyName` are denormalized for display.
 * Dates are `YYYY-MM-DD` (check-in inclusive, check-out exclusive).
 */
export type StaffReservation = {
  id: string;
  propertyId: string;
  propertyName: string;
  /** IANA TZ for property-local “today” (boards, confirmEarly). */
  propertyTimezone: string;
  unitId: string;
  unitCode: string;
  unitTypeId: string;
  source: ReservationSource;
  status: ReservationStatus;
  billingPeriod: StayBillingPeriod;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCount: number | null;
  notes: string | null;
  totalAmountIdr: number | null;
  /** Rent-only quote (create/edit form). */
  rentAmountIdr: number | null;
  electricityAmountIdr: number;
  waterAmountIdr: number;
  maintenanceAmountIdr: number;
  electricityRateIdrPerKwh: number;
  waterRateIdrPerM3: number;
  maintenanceFeeIdrPerMonth: number;
  /** Denormalized cache = sum(PaymentMovement.signedAmount). */
  paidAmountIdr: number;
  paymentStatus: PaymentStatus;
  collectedVia: CollectedVia | null;
  externalRef: string | null;
  icalSyncWarning: IcalSyncWarning | null;
  icalSyncWarnedAt: string | null;
  /** Target unit when warning is UNIT_DIFFER (OTA feed location). */
  icalObservedUnitId: string | null;
  /** Denormalized code for UNIT_DIFFER banner. */
  icalObservedUnitCode: string | null;
  /** OTA dates seen with UNIT_DIFFER (YYYY-MM-DD); may also differ from local. */
  icalObservedCheckInDate: string | null;
  icalObservedCheckOutDate: string | null;
  /** Import stub that overlaps another stay/block — not calendar-busy until Confirm. */
  icalOverlapHold: boolean;
  confirmedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Manual / desk create; null for iCal/system stubs. */
  createdByAdminId: string | null;
  updatedByAdminId: string | null;
  /** Denormalized for detail display. */
  createdByAdminUsername: string | null;
  updatedByAdminUsername: string | null;
  /** Cash timeline (newest-last in storage; UI sorts newest-first). */
  movements?: PaymentMovement[];
  /** Meter readings (detail GET / after utilities save). */
  utilityReadings?: ReservationUtilityReading[];
  /** Maintenance fee rows (detail GET / after utilities save). */
  maintenanceCharges?: ReservationMaintenanceCharge[];
  /** Soft desk reminder — next month utilities not recorded. */
  utilitiesDueNotice?: boolean;
  utilitiesNextDueDate?: string | null;
};

/**
 * Desk board list row (`GET /staff/reservations`).
 * Subset of StaffReservation — enough to paint the table; open detail for the rest.
 * (Unlike inventory lists, reservation edit is a separate detail GET.)
 */
export type StaffReservationListItem = Pick<
  StaffReservation,
  | "id"
  | "guestName"
  | "unitCode"
  | "billingPeriod"
  | "checkInDate"
  | "checkOutDate"
  | "status"
  | "source"
  | "totalAmountIdr"
  | "paidAmountIdr"
  | "paymentStatus"
  | "icalSyncWarning"
  | "icalOverlapHold"
  | "propertyTimezone"
  | "utilitiesDueNotice"
  | "utilitiesNextDueDate"
>;
