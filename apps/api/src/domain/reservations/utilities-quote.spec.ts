import {
  ReservationStatus,
  UtilityAddonKind,
  UtilityKind,
  applyUtilityAddons,
  computeMeterIntervalCharges,
  computeUtilitiesDueNotice,
  computeUtilityKindTotal,
  defaultFirstMaintenanceChargeDateYmd,
  defaultFirstMaintenanceChargeYearMonth,
  defaultNextMaintenanceChargeYearMonth,
  firstDayOfMonthYmd,
  firstDayOfNextMonthYmd,
  normalizeMaintenanceChargeDateYmd,
  recomputeStayQuoteTotal,
  sumAdminChargesIdr,
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
    expect(result.intervals[0].billedUnits).toBe(50.5);
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

  it('computeMeterIntervalCharges bills min kWh without rewriting meters', () => {
    const result = computeMeterIntervalCharges(
      [
        { readingDate: '2026-05-10', meterValue: 1000 },
        { readingDate: '2026-06-01', meterValue: 1023 },
        { readingDate: '2026-07-01', meterValue: 1040 },
      ],
      1700,
      { minBilledUnits: 52 },
    );
    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0].usage).toBe(23);
    expect(result.intervals[0].billedUnits).toBe(52);
    expect(result.intervals[0].amountIdr).toBe(Math.floor(52 * 1700));
    // Next interval starts from stored 1023 — meters are never rewritten.
    expect(result.intervals[1].usage).toBe(17);
    expect(result.intervals[1].billedUnits).toBe(52);
    expect(result.intervals[1].amountIdr).toBe(Math.floor(52 * 1700));
    expect(result.totalAmountIdr).toBe(Math.floor(52 * 1700) * 2);
  });

  it('applies add-ons per interval on min-billed usage Rp; meters stay actual', () => {
    const readings = [
      { readingDate: '2026-05-10', meterValue: 1000 },
      { readingDate: '2026-06-01', meterValue: 1023 },
    ];
    const charged = computeMeterIntervalCharges(readings, 1700, {
      minBilledUnits: 52,
    });
    expect(charged.intervals[0]?.usage).toBe(23);
    expect(charged.intervals[0]?.billedUnits).toBe(52);
    const usageRp = Math.floor(52 * 1700);
    expect(charged.intervals[0]?.amountIdr).toBe(usageRp);
    const addons = [
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'PJU',
        kind: UtilityAddonKind.PERCENT,
        value: 10,
        sortOrder: 0,
      },
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'Admin PLN',
        kind: UtilityAddonKind.CONSTANT,
        value: 5_000,
        sortOrder: 1,
      },
    ];
    expect(computeUtilityKindTotal(usageRp, addons)).toBe(
      usageRp + Math.floor((usageRp * 10) / 100) + 5_000,
    );
    expect(readings[1]?.meterValue).toBe(1023);
  });

  it('computeMeterIntervalCharges 2-arg call is no minimum', () => {
    const result = computeMeterIntervalCharges(
      [
        { readingDate: '2026-05-10', meterValue: 1000 },
        { readingDate: '2026-06-01', meterValue: 1023 },
      ],
      1700,
    );
    expect(result.intervals[0].usage).toBe(23);
    expect(result.intervals[0].billedUnits).toBe(23);
    expect(result.intervals[0].amountIdr).toBe(Math.floor(23 * 1700));
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
      adminAmountIdr: 0,
      totalAmountIdr: 1_100_000,
    });
  });

  it('recomputeStayQuoteTotal includes admin', () => {
    expect(
      recomputeStayQuoteTotal({
        rentAmountIdr: 1_000_000,
        electricityAmountIdr: 50_000,
        waterAmountIdr: 20_000,
        maintenanceAmountIdr: 30_000,
        adminAmountIdr: 10_000,
      }),
    ).toEqual({
      rentAmountIdr: 1_000_000,
      electricityAmountIdr: 50_000,
      waterAmountIdr: 20_000,
      maintenanceAmountIdr: 30_000,
      adminAmountIdr: 10_000,
      totalAmountIdr: 1_110_000,
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

  it('sumAdminChargesIdr aliases maintenance sum', () => {
    expect(
      sumAdminChargesIdr([{ amountIdr: 6_500 }, { amountIdr: 6_500 }]),
    ).toBe(13_000);
  });

  it('applyUtilityAddons percent is of usage Rp only, not of constants', () => {
    const result = applyUtilityAddons(100_000, [
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'Admin PLN',
        kind: UtilityAddonKind.CONSTANT,
        value: 6_500,
        sortOrder: 0,
      },
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'PPN',
        kind: UtilityAddonKind.PERCENT,
        value: 10,
        sortOrder: 1,
      },
    ]);
    expect(result.lines).toEqual([
      {
        name: 'Admin PLN',
        kind: UtilityAddonKind.CONSTANT,
        value: 6_500,
        amountIdr: 6_500,
      },
      {
        name: 'PPN',
        kind: UtilityAddonKind.PERCENT,
        value: 10,
        amountIdr: 10_000,
      },
    ]);
    expect(result.totalAddonIdr).toBe(16_500);
    expect(
      computeUtilityKindTotal(100_000, [
        {
          utility: UtilityKind.ELECTRICITY,
          name: 'Admin PLN',
          kind: UtilityAddonKind.CONSTANT,
          value: 6_500,
          sortOrder: 0,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          name: 'PPN',
          kind: UtilityAddonKind.PERCENT,
          value: 10,
          sortOrder: 1,
        },
      ]),
    ).toBe(116_500);
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

  it('computeUtilitiesDueNotice single reading in next month does NOT clear', () => {
    const notice = computeUtilitiesDueNotice({
      status: ReservationStatus.CHECKED_IN,
      billingPeriod: 'MONTHLY',
      checkInDate: '2026-07-08',
      checkOutDate: '2026-09-08',
      todayYmd: '2026-08-07',
      electricityReadings: [{ readingDate: '2026-07-08' }],
      // Water has an Aug 1st read, but elec + maint are still missing for Aug.
      waterReadings: [
        { readingDate: '2026-07-08' },
        { readingDate: '2026-08-01' },
      ],
      maintenanceCharges: [{ chargeDate: '2026-07-01' }],
    });
    expect(notice.utilitiesNextDueDate).toBe('2026-08-01');
    expect(notice.utilitiesDueNotice).toBe(true);
  });

  it('computeUtilitiesDueNotice clears only when all three present', () => {
    const notice = computeUtilitiesDueNotice({
      status: ReservationStatus.CHECKED_IN,
      billingPeriod: 'MONTHLY',
      checkInDate: '2026-07-08',
      checkOutDate: '2026-09-08',
      todayYmd: '2026-08-07',
      electricityReadings: [
        { readingDate: '2026-07-08' },
        { readingDate: '2026-08-01' },
      ],
      waterReadings: [
        { readingDate: '2026-07-08' },
        { readingDate: '2026-08-01' },
      ],
      maintenanceCharges: [
        { chargeDate: '2026-07-01' },
        { chargeDate: '2026-08-01' },
      ],
    });
    // Aug fully covered by all three → notice clears, due advances to Sept.
    expect(notice.utilitiesNextDueDate).toBe('2026-09-01');
    expect(notice.utilitiesDueNotice).toBe(false);
  });
});
