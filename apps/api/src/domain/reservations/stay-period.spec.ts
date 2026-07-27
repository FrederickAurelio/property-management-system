import {
  StayBillingPeriod,
  STAY_MONTHLY_COUNT_MAX,
  STAY_YEARLY_COUNT_MAX,
  addCalendarMonthsYmd,
  addCalendarYearsYmd,
  checkoutFromPeriodCount,
  isValidStayPeriodRange,
  periodCountFromRange,
} from '@cabin/api-contract';

describe('stay billing period helpers', () => {
  it('adds calendar months with same-date exclusive checkout', () => {
    expect(addCalendarMonthsYmd('2026-06-26', 1)).toBe('2026-07-26');
    expect(addCalendarMonthsYmd('2026-02-02', 1)).toBe('2026-03-02');
  });

  it('clamps EOM when target month lacks the day', () => {
    expect(addCalendarMonthsYmd('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarMonthsYmd('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('adds calendar years with leap-day clamp', () => {
    expect(addCalendarYearsYmd('2024-02-29', 1)).toBe('2025-02-28');
    expect(addCalendarYearsYmd('2026-07-24', 1)).toBe('2027-07-24');
  });

  it('derives period counts and validates ranges', () => {
    expect(
      periodCountFromRange(StayBillingPeriod.DAILY, '2026-08-01', '2026-08-04'),
    ).toBe(3);
    expect(
      periodCountFromRange(
        StayBillingPeriod.MONTHLY,
        '2026-06-26',
        '2026-07-26',
      ),
    ).toBe(1);
    expect(
      periodCountFromRange(
        StayBillingPeriod.MONTHLY,
        '2026-06-26',
        '2026-07-27',
      ),
    ).toBeNull();
    expect(
      isValidStayPeriodRange(
        StayBillingPeriod.YEARLY,
        '2026-07-24',
        '2027-07-24',
      ),
    ).toBe(true);
  });

  it('derives long monthly/yearly counts via calendar delta (not a 1…N scan)', () => {
    const inYmd = '2016-06-26';
    const out120 = addCalendarMonthsYmd(inYmd, STAY_MONTHLY_COUNT_MAX);
    expect(periodCountFromRange(StayBillingPeriod.MONTHLY, inYmd, out120)).toBe(
      STAY_MONTHLY_COUNT_MAX,
    );
    const out121 = addCalendarMonthsYmd(inYmd, STAY_MONTHLY_COUNT_MAX + 1);
    expect(
      periodCountFromRange(StayBillingPeriod.MONTHLY, inYmd, out121),
    ).toBeNull();

    const yearIn = '1996-07-24';
    const yearOut30 = addCalendarYearsYmd(yearIn, STAY_YEARLY_COUNT_MAX);
    expect(
      periodCountFromRange(StayBillingPeriod.YEARLY, yearIn, yearOut30),
    ).toBe(STAY_YEARLY_COUNT_MAX);
    const yearOut31 = addCalendarYearsYmd(yearIn, STAY_YEARLY_COUNT_MAX + 1);
    expect(
      periodCountFromRange(StayBillingPeriod.YEARLY, yearIn, yearOut31),
    ).toBeNull();
  });

  it('builds checkout from period count', () => {
    expect(
      checkoutFromPeriodCount(StayBillingPeriod.DAILY, '2026-08-01', 5),
    ).toBe('2026-08-06');
    expect(
      checkoutFromPeriodCount(StayBillingPeriod.MONTHLY, '2026-01-31', 1),
    ).toBe('2026-02-28');
    expect(
      checkoutFromPeriodCount(StayBillingPeriod.YEARLY, '2024-02-29', 1),
    ).toBe('2025-02-28');
    expect(
      checkoutFromPeriodCount(
        StayBillingPeriod.MONTHLY,
        '2026-06-26',
        STAY_MONTHLY_COUNT_MAX + 1,
      ),
    ).toBe('2026-06-26');
  });
});
