import {
  ReservationStatus,
  computeMeterIntervalCharges,
  computeUtilitiesDueNotice,
  defaultFirstMaintenanceChargeDateYmd,
  defaultFirstMaintenanceChargeYearMonth,
  defaultNextMaintenanceChargeYearMonth,
  firstDayOfMonthYmd,
  firstDayOfNextMonthYmd,
  normalizeMaintenanceChargeDateYmd,
  recomputeStayQuoteTotal,
  sumMaintenanceChargesIdr,
  yearMonthToChargeDateYmd,
} from '@cabin/api-contract';

describe('utility quote helpers', () => {
  it('firstDayOfMonthYmd snaps to the 1st of that month', () => {
    expect(firstDayOfMonthYmd('2026-05-10')).toBe('2026-05-01');
    expect(firstDayOfMonthYmd('2026-01-01')).toBe('2026-01-01');
  });

  it('defaultFirstMaintenanceChargeDateYmd uses check-in month, not check-in day', () => {
    expect(defaultFirstMaintenanceChargeDateYmd('2026-05-10')).toBe(
      '2026-05-01',
    );
  });

  it('maintenance month helpers use YYYY-MM and store as 1st', () => {
    expect(defaultFirstMaintenanceChargeYearMonth('2026-05-10')).toBe(
      '2026-05',
    );
    expect(defaultNextMaintenanceChargeYearMonth('2026-05')).toBe('2026-06');
    expect(yearMonthToChargeDateYmd('2026-05')).toBe('2026-05-01');
    expect(normalizeMaintenanceChargeDateYmd('2026-05-17')).toBe('2026-05-01');
  });

  it('firstDayOfNextMonthYmd advances to the 1st', () => {
    expect(firstDayOfNextMonthYmd('2026-05-10')).toBe('2026-06-01');
    expect(firstDayOfNextMonthYmd('2026-12-31')).toBe('2027-01-01');
  });

  it('computeMeterIntervalCharges sums usage × rate', () => {
    const result = computeMeterIntervalCharges(
      [
        { readingDate: '2026-05-10', meterValue: 100 },
        { readingDate: '2026-06-01', meterValue: 150.5 },
        { readingDate: '2026-07-01', meterValue: 200 },
      ],
      2000,
    );
    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0].usage).toBe(50.5);
    expect(result.intervals[0].amountIdr).toBe(Math.floor(50.5 * 2000));
    expect(result.totalAmountIdr).toBe(
      Math.floor(50.5 * 2000) + Math.floor(49.5 * 2000),
    );
  });

  it('computeMeterIntervalCharges rejects meter decrease', () => {
    expect(() =>
      computeMeterIntervalCharges(
        [
          { readingDate: '2026-05-10', meterValue: 100 },
          { readingDate: '2026-06-01', meterValue: 90 },
        ],
        1000,
      ),
    ).toThrow('METER_DECREASED');
  });

  it('recomputeStayQuoteTotal sums rent + utilities', () => {
    expect(
      recomputeStayQuoteTotal({
        rentAmountIdr: 1_000_000,
        electricityAmountIdr: 50_000,
        waterAmountIdr: 20_000,
        maintenanceAmountIdr: 30_000,
      }),
    ).toEqual({
      rentAmountIdr: 1_000_000,
      electricityAmountIdr: 50_000,
      waterAmountIdr: 20_000,
      maintenanceAmountIdr: 30_000,
      totalAmountIdr: 1_100_000,
    });
  });

  it('sumMaintenanceChargesIdr totals rows', () => {
    expect(
      sumMaintenanceChargesIdr([
        { amountIdr: 100_000 },
        { amountIdr: 100_000 },
      ]),
    ).toBe(200_000);
  });

  it('computeUtilitiesDueNotice flags missing next month on MONTHLY', () => {
    const notice = computeUtilitiesDueNotice({
      status: ReservationStatus.CHECKED_IN,
      billingPeriod: 'MONTHLY',
      checkInDate: '2026-05-10',
      checkOutDate: '2026-12-10',
      todayYmd: '2026-06-05',
      electricityReadings: [{ readingDate: '2026-05-10' }],
      waterReadings: [{ readingDate: '2026-05-10' }],
      maintenanceCharges: [],
    });
    expect(notice.utilitiesNextDueDate).toBe('2026-06-01');
    expect(notice.utilitiesDueNotice).toBe(true);
  });

  it('computeUtilitiesDueNotice never flags DAILY', () => {
    const notice = computeUtilitiesDueNotice({
      status: ReservationStatus.CHECKED_IN,
      billingPeriod: 'DAILY',
      checkInDate: '2026-05-10',
      checkOutDate: '2026-12-10',
      todayYmd: '2026-06-05',
      electricityReadings: [{ readingDate: '2026-05-10' }],
      waterReadings: [{ readingDate: '2026-05-10' }],
      maintenanceCharges: [],
    });
    expect(notice.utilitiesNextDueDate).toBe('2026-06-01');
    expect(notice.utilitiesDueNotice).toBe(false);
  });

  it('computeUtilitiesDueNotice clears when month covered', () => {
    const notice = computeUtilitiesDueNotice({
      status: ReservationStatus.CHECKED_IN,
      billingPeriod: 'YEARLY',
      checkInDate: '2026-05-10',
      checkOutDate: '2026-12-10',
      todayYmd: '2026-06-05',
      electricityReadings: [
        { readingDate: '2026-05-10' },
        { readingDate: '2026-06-01' },
      ],
      waterReadings: [
        { readingDate: '2026-05-10' },
        { readingDate: '2026-06-01' },
      ],
      maintenanceCharges: [{ chargeDate: '2026-06-01' }],
    });
    expect(notice.utilitiesDueNotice).toBe(false);
  });
});
