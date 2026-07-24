import {
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  StaffDashboardAttentionKind,
  StayBillingPeriod,
  type StaffReservationListItem,
} from '@cabin/api-contract';
import {
  assembleArrivalsSection,
  assembleNeedsAttentionSection,
  DASHBOARD_SECTION_CAP,
  sortArrivals,
  tagAttentionKinds,
} from './dashboard-assemble.js';

const TZ = 'Asia/Jakarta';
const TODAY = '2026-07-23';
const TOMORROW = '2026-07-24';

function item(
  partial: Partial<StaffReservationListItem> &
    Pick<StaffReservationListItem, 'id' | 'guestName' | 'status'>,
): StaffReservationListItem {
  return {
    unitCode: 'A-01',
    billingPeriod: StayBillingPeriod.DAILY,
    checkInDate: TODAY,
    checkOutDate: TOMORROW,
    source: ReservationSource.MANUAL,
    totalAmountIdr: 1_000_000,
    paidAmountIdr: 1_000_000,
    paymentStatus: PaymentStatus.PAID,
    icalSyncWarning: null,
    propertyTimezone: TZ,
    ...partial,
  };
}

describe('dashboard-assemble', () => {
  describe('tagAttentionKinds', () => {
    const ctx = { today: TODAY, tomorrow: TOMORROW };

    it('tags stranded CONFIRMED', () => {
      const kinds = tagAttentionKinds(
        item({
          id: '1',
          guestName: 'A',
          status: ReservationStatus.CONFIRMED,
          checkInDate: '2026-07-20',
          checkOutDate: '2026-07-22',
        }),
        ctx,
      );
      expect(kinds).toEqual([StaffDashboardAttentionKind.STRANDED_CONFIRMED]);
    });

    it('tags open balance mid-stay and checked out', () => {
      expect(
        tagAttentionKinds(
          item({
            id: '2',
            guestName: 'B',
            status: ReservationStatus.CHECKED_IN,
            checkInDate: '2026-07-20',
            checkOutDate: '2026-07-28',
            paidAmountIdr: 100_000,
            paymentStatus: PaymentStatus.DEPOSIT,
          }),
          ctx,
        ),
      ).toContain(StaffDashboardAttentionKind.OPEN_BALANCE);

      expect(
        tagAttentionKinds(
          item({
            id: '3',
            guestName: 'C',
            status: ReservationStatus.CHECKED_OUT,
            checkInDate: '2026-07-10',
            checkOutDate: '2026-07-15',
            paidAmountIdr: 100_000,
            paymentStatus: PaymentStatus.DEPOSIT,
          }),
          ctx,
        ),
      ).toContain(StaffDashboardAttentionKind.OPEN_BALANCE);

      // Stale DEPOSIT still matches board money OR — Why must not be empty
      expect(
        tagAttentionKinds(
          item({
            id: '3b',
            guestName: 'Stale',
            status: ReservationStatus.CHECKED_OUT,
            checkInDate: '2026-07-10',
            checkOutDate: '2026-07-15',
            totalAmountIdr: 1_000_000,
            paidAmountIdr: 1_000_000,
            paymentStatus: PaymentStatus.DEPOSIT,
          }),
          ctx,
        ),
      ).toContain(StaffDashboardAttentionKind.OPEN_BALANCE);
    });

    it('tags needs details soon and iCal', () => {
      expect(
        tagAttentionKinds(
          item({
            id: '4',
            guestName: 'D',
            status: ReservationStatus.UNCONFIRMED,
            checkInDate: TOMORROW,
            checkOutDate: '2026-07-26',
            totalAmountIdr: null,
            paidAmountIdr: 0,
          }),
          ctx,
        ),
      ).toContain(StaffDashboardAttentionKind.NEEDS_DETAILS);

      expect(
        tagAttentionKinds(
          item({
            id: '5',
            guestName: 'E',
            status: ReservationStatus.CHECKED_IN,
            checkInDate: '2026-07-20',
            checkOutDate: '2026-07-28',
            icalSyncWarning: 'DATES_DIFFER',
          }),
          ctx,
        ),
      ).toContain(StaffDashboardAttentionKind.ICAL);
    });
  });

  describe('sortArrivals', () => {
    it('orders late before on-time, then open money', () => {
      const sorted = sortArrivals(
        [
          item({
            id: 'on-time-settled',
            guestName: 'Zed',
            status: ReservationStatus.CONFIRMED,
            checkInDate: TODAY,
            paidAmountIdr: 1_000_000,
            paymentStatus: PaymentStatus.PAID,
          }),
          item({
            id: 'on-time-due',
            guestName: 'Amy',
            status: ReservationStatus.CONFIRMED,
            checkInDate: TODAY,
            paidAmountIdr: 0,
            paymentStatus: PaymentStatus.UNPAID,
          }),
          item({
            id: 'late',
            guestName: 'Bob',
            status: ReservationStatus.CONFIRMED,
            checkInDate: '2026-07-21',
            checkOutDate: '2026-07-28',
            paidAmountIdr: 1_000_000,
            paymentStatus: PaymentStatus.PAID,
          }),
        ],
        TODAY,
      );
      expect(sorted.map((r) => r.id)).toEqual([
        'late',
        'on-time-due',
        'on-time-settled',
      ]);
    });
  });

  describe('sortNeedsAttention', () => {
    it('orders stranded before open balance before details', () => {
      const ctx = { today: TODAY, tomorrow: TOMORROW };
      const section = assembleNeedsAttentionSection(
        [
          item({
            id: 'details',
            guestName: 'Stub',
            status: ReservationStatus.UNCONFIRMED,
            checkInDate: TOMORROW,
            totalAmountIdr: null,
            paidAmountIdr: 0,
            paymentStatus: PaymentStatus.UNPAID,
          }),
          item({
            id: 'due',
            guestName: 'Due',
            status: ReservationStatus.CHECKED_IN,
            checkInDate: '2026-07-20',
            checkOutDate: '2026-07-28',
            paidAmountIdr: 0,
            paymentStatus: PaymentStatus.UNPAID,
          }),
          item({
            id: 'stranded',
            guestName: 'Gone',
            status: ReservationStatus.CONFIRMED,
            checkInDate: '2026-07-18',
            checkOutDate: '2026-07-20',
            paidAmountIdr: 0,
            paymentStatus: PaymentStatus.UNPAID,
          }),
        ],
        ctx,
        3,
      );
      expect(section.items.map((r) => r.id)).toEqual([
        'stranded',
        'due',
        'details',
      ]);
    });
  });

  describe('capSection', () => {
    it('caps items at 8 and keeps honest total', () => {
      const rows = Array.from({ length: 10 }, (_, i) =>
        item({
          id: `a${i}`,
          guestName: `Guest ${String(i).padStart(2, '0')}`,
          status: ReservationStatus.CONFIRMED,
          checkInDate: TODAY,
        }),
      );
      const section = assembleArrivalsSection(rows, TODAY, 12);
      expect(section.total).toBe(12);
      expect(section.items).toHaveLength(DASHBOARD_SECTION_CAP);
    });
  });
});
