import {
  openAmountIdr,
  PaymentStatus,
  ReservationStatus,
  StaffDashboardAttentionKind,
  type StaffDashboardListItem,
  type StaffDashboardSection,
  type StaffReservationListItem,
} from '@cabin/api-contract';

export const DASHBOARD_SECTION_CAP = 8;

function rowOpenAmountIdr(
  row: Pick<StaffReservationListItem, 'totalAmountIdr' | 'paidAmountIdr'>,
): number {
  return openAmountIdr(row.totalAmountIdr, row.paidAmountIdr);
}

function hasOpenMoney(
  row: Pick<StaffReservationListItem, 'totalAmountIdr' | 'paidAmountIdr'>,
): boolean {
  return rowOpenAmountIdr(row) > 0;
}

/**
 * Same semantics as `openBalanceMoneyClause` (balance-due board money OR),
 * expressed on list-item fields so Why chips never disagree with the filter.
 */
function matchesOpenBalanceMoney(row: StaffReservationListItem): boolean {
  if (hasOpenMoney(row)) return true;
  if (row.paymentStatus === PaymentStatus.DEPOSIT) return true;
  if (
    row.paymentStatus === PaymentStatus.UNPAID &&
    row.totalAmountIdr != null &&
    row.totalAmountIdr > 0
  ) {
    return true;
  }
  return false;
}

export type AttentionTagContext = {
  /** Property-local YYYY-MM-DD. */
  today: string;
  /** Property-local tomorrow YYYY-MM-DD. */
  tomorrow: string;
};

/**
 * Tag why a Needs row appears (may combine). Caller only passes Needs candidates
 * (already excluding arrivals/departures windows).
 */
export function tagAttentionKinds(
  row: StaffReservationListItem,
  ctx: AttentionTagContext,
): StaffDashboardAttentionKind[] {
  const kinds: StaffDashboardAttentionKind[] = [];

  const stranded =
    row.status === ReservationStatus.CONFIRMED && row.checkOutDate <= ctx.today;
  if (stranded) {
    kinds.push(StaffDashboardAttentionKind.STRANDED_CONFIRMED);
  }

  const openBalanceInHouse =
    row.status === ReservationStatus.CHECKED_IN &&
    row.checkOutDate > ctx.today &&
    matchesOpenBalanceMoney(row);
  const openBalanceCheckedOut =
    row.status === ReservationStatus.CHECKED_OUT &&
    matchesOpenBalanceMoney(row);
  if (openBalanceInHouse || openBalanceCheckedOut) {
    kinds.push(StaffDashboardAttentionKind.OPEN_BALANCE);
  }

  const needsDetails =
    row.status === ReservationStatus.UNCONFIRMED &&
    row.checkInDate <= ctx.tomorrow;
  if (needsDetails) {
    kinds.push(StaffDashboardAttentionKind.NEEDS_DETAILS);
  }

  if (row.icalSyncWarning != null) {
    kinds.push(StaffDashboardAttentionKind.ICAL);
  }

  return kinds;
}

function cmpGuest(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/** Arrivals: late first · open money · checkInDate asc · guest. */
export function sortArrivals(
  rows: StaffReservationListItem[],
  today: string,
): StaffReservationListItem[] {
  return [...rows].sort((a, b) => {
    const aLate = a.checkInDate < today ? 0 : 1;
    const bLate = b.checkInDate < today ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;

    const aOpen = hasOpenMoney(a) ? 0 : 1;
    const bOpen = hasOpenMoney(b) ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;

    if (a.checkInDate !== b.checkInDate) {
      return a.checkInDate < b.checkInDate ? -1 : 1;
    }
    return cmpGuest(a.guestName, b.guestName);
  });
}

/** Departures: late first · open money · checkOutDate asc · guest. */
export function sortDepartures(
  rows: StaffReservationListItem[],
  today: string,
): StaffReservationListItem[] {
  return [...rows].sort((a, b) => {
    const aLate = a.checkOutDate < today ? 0 : 1;
    const bLate = b.checkOutDate < today ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;

    const aOpen = hasOpenMoney(a) ? 0 : 1;
    const bOpen = hasOpenMoney(b) ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;

    if (a.checkOutDate !== b.checkOutDate) {
      return a.checkOutDate < b.checkOutDate ? -1 : 1;
    }
    return cmpGuest(a.guestName, b.guestName);
  });
}

/**
 * Needs sort bucket (lower = earlier):
 * 0 stranded · 1 open balance · 2 needs details · 3 iCal-only.
 */
function needsSortBucket(kinds: StaffDashboardAttentionKind[]): number {
  if (kinds.includes(StaffDashboardAttentionKind.STRANDED_CONFIRMED)) return 0;
  if (kinds.includes(StaffDashboardAttentionKind.OPEN_BALANCE)) return 1;
  if (kinds.includes(StaffDashboardAttentionKind.NEEDS_DETAILS)) return 2;
  return 3;
}

/** Needs: stranded · open-balance (amount, CHECKED_OUT before mid-stay) · details · iCal. */
export function sortNeedsAttention(
  rows: StaffDashboardListItem[],
): StaffDashboardListItem[] {
  return [...rows].sort((a, b) => {
    const aKinds = a.attentionKinds ?? [];
    const bKinds = b.attentionKinds ?? [];
    const aBucket = needsSortBucket(aKinds);
    const bBucket = needsSortBucket(bKinds);
    if (aBucket !== bBucket) return aBucket - bBucket;

    if (aBucket === 0) {
      if (a.checkOutDate !== b.checkOutDate) {
        return a.checkOutDate < b.checkOutDate ? -1 : 1;
      }
      return cmpGuest(a.guestName, b.guestName);
    }

    if (aBucket === 1) {
      const amtDiff = rowOpenAmountIdr(b) - rowOpenAmountIdr(a);
      if (amtDiff !== 0) return amtDiff;
      const aOut = a.status === ReservationStatus.CHECKED_OUT ? 0 : 1;
      const bOut = b.status === ReservationStatus.CHECKED_OUT ? 0 : 1;
      if (aOut !== bOut) return aOut - bOut;
      return cmpGuest(a.guestName, b.guestName);
    }

    if (aBucket === 2) {
      if (a.checkInDate !== b.checkInDate) {
        return a.checkInDate < b.checkInDate ? -1 : 1;
      }
      return cmpGuest(a.guestName, b.guestName);
    }

    // iCal: CHECKED_IN warnings first
    const aIn = a.status === ReservationStatus.CHECKED_IN ? 0 : 1;
    const bIn = b.status === ReservationStatus.CHECKED_IN ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return cmpGuest(a.guestName, b.guestName);
  });
}

export function capSection<T>(
  rows: T[],
  total: number,
  cap = DASHBOARD_SECTION_CAP,
): StaffDashboardSection<T> {
  return {
    total,
    items: rows.slice(0, cap),
  };
}

export function assembleArrivalsSection(
  rows: StaffReservationListItem[],
  today: string,
  total: number,
): StaffDashboardSection<StaffReservationListItem> {
  return capSection(sortArrivals(rows, today), total);
}

export function assembleDeparturesSection(
  rows: StaffReservationListItem[],
  today: string,
  total: number,
): StaffDashboardSection<StaffReservationListItem> {
  return capSection(sortDepartures(rows, today), total);
}

export function assembleNeedsAttentionSection(
  rows: StaffReservationListItem[],
  ctx: AttentionTagContext,
  total: number,
): StaffDashboardSection<StaffDashboardListItem> {
  const tagged: StaffDashboardListItem[] = rows.map((row) => ({
    ...row,
    attentionKinds: tagAttentionKinds(row, ctx),
  }));
  return capSection(sortNeedsAttention(tagged), total);
}
