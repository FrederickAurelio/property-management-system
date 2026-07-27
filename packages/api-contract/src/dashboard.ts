import type { StaffReservationListItem } from './reservations.js';

/** Query params for staff dashboard triage aggregate. */
export type StaffDashboardParams = {
  propertyId: string;
  /** Property-local YYYY-MM-DD; omit = today in property TZ. */
  date?: string;
};

/** Why a row appears under Needs attention (may combine on one row). */
export const StaffDashboardAttentionKind = {
  OPEN_BALANCE: 'OPEN_BALANCE',
  STRANDED_CONFIRMED: 'STRANDED_CONFIRMED',
  NEEDS_DETAILS: 'NEEDS_DETAILS',
  ICAL: 'ICAL',
} as const;

export type StaffDashboardAttentionKind =
  (typeof StaffDashboardAttentionKind)[keyof typeof StaffDashboardAttentionKind];

/** Needs-attention list row — slim desk item + attention kinds. */
export type StaffDashboardListItem = StaffReservationListItem & {
  attentionKinds?: StaffDashboardAttentionKind[];
};

/**
 * Section bucket: `items` may be capped (≤8); `total` is the full matching count.
 */
export type StaffDashboardSection<T> = {
  total: number;
  items: T[];
};

/** Staff desk home triage for one property (today + exceptions). */
export type StaffDashboardIcalFeedHealthItem = {
  unitCode: string;
  source: string;
  lastError: string;
};

export type StaffDashboardIcalFeedHealth = {
  failingCount: number;
  /** Up to 5 failing feeds for the property. */
  feeds: StaffDashboardIcalFeedHealthItem[];
};

export type StaffDashboard = {
  propertyId: string;
  /** Property-local calendar date (YYYY-MM-DD). */
  date: string;
  propertyTimezone: string;
  arrivals: StaffDashboardSection<StaffReservationListItem>;
  departures: StaffDashboardSection<StaffReservationListItem>;
  needsAttention: StaffDashboardSection<StaffDashboardListItem>;
  icalFeedHealth: StaffDashboardIcalFeedHealth;
};
