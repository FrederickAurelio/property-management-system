import type { CollectedVia } from './reservations.js';
import type { ReservationSource } from './reservations.js';

/** Query params for staff reports summary (period review). */
export type StaffReportsSummaryParams = {
  propertyId: string;
  /** Inclusive primary period start (YYYY-MM-DD). */
  from: string;
  /** Inclusive primary period end (YYYY-MM-DD). */
  to: string;
  /** When true, payload includes previous equal-length compare bundle. */
  compare?: boolean;
};

export type StaffReportsCashMethodRow = {
  /** `null` = Unspecified (movement.method null). */
  method: CollectedVia | null;
  inIdr: number;
  outIdr: number;
  netIdr: number;
};

export type StaffReportsCashSourceRow = {
  source: ReservationSource;
  inIdr: number;
  outIdr: number;
  netIdr: number;
};

export type StaffReportsCashCompare = {
  inIdr: number;
  outIdr: number;
  netIdr: number;
  /** Absolute net delta: primary net − previous net. */
  netDeltaIdr: number;
  /** Percent delta on net; null if previous net is 0. */
  netDeltaPct: number | null;
};

export type StaffReportsCash = {
  inIdr: number;
  outIdr: number;
  netIdr: number;
  byMethod: StaffReportsCashMethodRow[];
  bySource: StaffReportsCashSourceRow[];
  compare?: StaffReportsCashCompare;
};

export type StaffReportsOccupancyCompare = {
  occupiedNights: number;
  availableNights: number;
  /** null when available nights = 0. */
  occupancyPct: number | null;
  /** Percentage-point delta; null if either period is n/a. */
  occupancyPctDelta: number | null;
};

export type StaffReportsOccupancy = {
  occupiedNights: number;
  availableNights: number;
  /** null when available nights = 0. */
  occupancyPct: number | null;
  compare?: StaffReportsOccupancyCompare;
};

export type StaffReportsOccupancyByUnitType = {
  unitTypeId: string | null;
  name: string;
  sortOrder: number;
  occupiedNights: number;
  availableNights: number;
  occupancyPct: number | null;
  compare?: {
    occupiedNights: number;
    availableNights: number;
    occupancyPct: number | null;
    occupancyPctDelta: number | null;
  };
};

export type StaffReportsSourceMixRow = {
  source: ReservationSource;
  /** Stays with checkIn in the primary period. */
  staysCheckInInPeriod: number;
  /** Occupied unit-nights in period attributed to this source. */
  nights: number;
  /** nights ÷ property occupied nights; 0 when property occupied is 0. */
  pctOfNights: number;
  compare?: {
    staysCheckInInPeriod: number;
    nights: number;
    pctOfNights: number;
    nightsDelta: number;
  };
};

/**
 * One payload for `/staff/reports/summary` — drives the whole `/reports` page.
 * Money helpers stay on reservation/movement types; this is aggregates only.
 * Open balances stay on Reservations boards — not duplicated here.
 */
export type StaffReportsSummary = {
  propertyId: string;
  from: string;
  to: string;
  /** Present when compare was requested. Equal-length window before `from`. */
  compare?: {
    from: string;
    to: string;
  };
  cash: StaffReportsCash;
  occupancy: StaffReportsOccupancy;
  occupancyByUnitType: StaffReportsOccupancyByUnitType[];
  sourceMix: StaffReportsSourceMixRow[];
};
