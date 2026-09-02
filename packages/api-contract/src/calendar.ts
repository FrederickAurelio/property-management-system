import type { UnitStatus } from './inventory.js';
import {
  OCCUPYING_RESERVATION_STATUSES,
  ReservationStatus,
  type CollectedVia,
  type IcalSyncWarning,
  type PaymentStatus,
  type ReservationSource,
} from './reservations.js';

/**
 * Statuses returned on the property calendar aggregate (paint).
 * Occupying plus `CHECKED_OUT` history — history does **not** occupy.
 * Overlap / availability / iCal busy stay on `OCCUPYING_RESERVATION_STATUSES`.
 */
export const CALENDAR_PAINT_RESERVATION_STATUSES: readonly ReservationStatus[] =
  [...OCCUPYING_RESERVATION_STATUSES, ReservationStatus.CHECKED_OUT];

/** Non-guest busy on the unit calendar — not an OTA stub. */
export const CalendarBlockKind = {
  MAINTENANCE: 'MAINTENANCE',
  OWNER: 'OWNER',
  HOLD: 'HOLD',
  OTHER: 'OTHER',
} as const;

export type CalendarBlockKind =
  (typeof CalendarBlockKind)[keyof typeof CalendarBlockKind];

export const CALENDAR_BLOCK_NOTE_MAX = 500;

/** Unit type header for calendar grouping (denormalized). */
export type StaffCalendarUnitType = {
  id: string;
  name: string;
  sortOrder: number;
};

/** One row on the property calendar grid. */
export type StaffCalendarUnit = {
  id: string;
  code: string;
  name: string | null;
  status: UnitStatus;
  sortOrder: number;
  unitType: StaffCalendarUnitType | null;
};

/**
 * Stay slice for calendar bars (occupying + checked-out history).
 * Subset of StaffReservation — enough to paint + open detail.
 * `CHECKED_OUT` is paint-only; occupancy extras must filter occupying statuses.
 */
export type StaffCalendarStay = {
  id: string;
  unitId: string;
  source: ReservationSource;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  /** Exclusive inventory busy end (FAR for open monthly/yearly holds). */
  inventoryEndDate: string;
  guestName: string;
  totalAmountIdr: number | null;
  paidAmountIdr: number;
  paymentStatus: PaymentStatus;
  collectedVia: CollectedVia | null;
  icalSyncWarning: IcalSyncWarning | null;
  propertyTimezone: string;
};

export type StaffCalendarBlock = {
  id: string;
  propertyId: string;
  unitId: string;
  kind: CalendarBlockKind;
  /** Inclusive start (YYYY-MM-DD). */
  startDate: string;
  /** Exclusive end (YYYY-MM-DD) — same night math as reservation checkout. */
  endDate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Aggregate paint payload for `GET /staff/properties/:propertyId/calendar`.
 * Range is `[from, to)` property-local dates.
 * `stays` includes occupying bars and checked-out history (not cancelled).
 */
export type StaffPropertyCalendar = {
  propertyId: string;
  from: string;
  to: string;
  units: StaffCalendarUnit[];
  stays: StaffCalendarStay[];
  blocks: StaffCalendarBlock[];
};

export type CreateStaffCalendarBlockInput = {
  propertyId: string;
  unitId: string;
  kind: CalendarBlockKind;
  startDate: string;
  endDate: string;
  note?: string | null;
};

export type UpdateStaffCalendarBlockInput = {
  unitId?: string;
  kind?: CalendarBlockKind;
  startDate?: string;
  endDate?: string;
  note?: string | null;
};
