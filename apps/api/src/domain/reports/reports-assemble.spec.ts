import {
  CollectedVia,
  ReservationSource,
  inclusiveDayCount,
  previousEqualPeriod,
  ymdInclusiveToUtcHalfOpen,
  zonedYmdStartUtc,
  addDaysYmd,
} from '@cabin/api-contract';
import {
  assembleCash,
  assembleOccupancy,
  assembleSourceMix,
  occupancyPct,
  toInt,
  type CashAggRow,
  type InventoryUnit,
} from './reports-assemble';

describe('reports period helpers (api-contract)', () => {
  it('inclusiveDayCount is inclusive', () => {
    expect(inclusiveDayCount('2026-07-01', '2026-07-01')).toBe(1);
    expect(inclusiveDayCount('2026-07-01', '2026-07-23')).toBe(23);
  });

  it('previousEqualPeriod matches equal length before from', () => {
    expect(previousEqualPeriod('2026-07-01', '2026-07-23')).toEqual({
      from: '2026-06-08',
      to: '2026-06-30',
    });
  });

  it('ymdInclusiveToUtcHalfOpen is half-open in Asia/Jakarta', () => {
    const { start, endExclusive } = ymdInclusiveToUtcHalfOpen(
      '2026-07-01',
      '2026-07-01',
      'Asia/Jakarta',
    );
    expect(start.toISOString()).toBe('2026-06-30T17:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-07-01T17:00:00.000Z');
    expect(endExclusive.getTime()).toBe(
      zonedYmdStartUtc(addDaysYmd('2026-07-01', 1), 'Asia/Jakarta').getTime(),
    );
  });
});

describe('reports-assemble', () => {
  const inventory: InventoryUnit[] = [
    {
      id: 'u1',
      name: 'Deluxe 1',
      sortOrder: 1,
      unitTypeId: 't1',
      unitTypeName: 'Deluxe',
      unitTypeSortOrder: 1,
    },
    {
      id: 'u2',
      name: 'Garden A',
      sortOrder: 1,
      unitTypeId: 't2',
      unitTypeName: 'Garden',
      unitTypeSortOrder: 2,
    },
  ];

  it('assembleCash pivots source/type/method and compare deltas', () => {
    const rows: CashAggRow[] = [
      {
        period: 'primary',
        source: ReservationSource.AIRBNB,
        unitTypeId: 't1',
        method: CollectedVia.CHANNEL,
        inIdr: 1_000_000,
        outIdr: 100_000,
      },
      {
        period: 'primary',
        source: ReservationSource.MANUAL,
        unitTypeId: 't2',
        method: CollectedVia.PROPERTY,
        inIdr: 500_000,
        outIdr: 0,
      },
      {
        period: 'compare',
        source: ReservationSource.AIRBNB,
        unitTypeId: 't1',
        method: CollectedVia.CHANNEL,
        inIdr: 800_000,
        outIdr: 0,
      },
    ];

    const cash = assembleCash(rows, inventory, true);
    expect(cash.inIdr).toBe(1_500_000);
    expect(cash.outIdr).toBe(100_000);
    expect(cash.netIdr).toBe(1_400_000);
    expect(cash.bySource).toHaveLength(5);
    expect(
      cash.bySource.find((r) => r.source === ReservationSource.AIRBNB)?.netIdr,
    ).toBe(900_000);
    expect(cash.byUnitType.map((r) => r.unitTypeId).sort()).toEqual([
      't1',
      't2',
    ]);
    expect(cash.byMethod).toHaveLength(4);
    expect(cash.compare?.netIdr).toBe(800_000);
    expect(cash.compare?.netDeltaIdr).toBe(600_000);
    expect(cash.compare?.netDeltaPct).toBe(75);
    expect(cash.guestInIdr).toBe(1_500_000);
    expect(cash.guestOutIdr).toBe(100_000);
    expect(cash.expenseOutIdr).toBe(0);
    expect(cash.billed.totalIdr).toBe(0);
  });

  it('assembleCash adds expenses into Out and Net', () => {
    const cash = assembleCash(
      [
        {
          period: 'primary',
          source: ReservationSource.MANUAL,
          unitTypeId: 't1',
          method: null,
          inIdr: 1_000_000,
          outIdr: 50_000,
        },
      ],
      inventory,
      false,
      [{ period: 'primary', category: 'UTILITIES', outIdr: 300_000 }],
    );
    expect(cash.inIdr).toBe(1_000_000);
    expect(cash.guestOutIdr).toBe(50_000);
    expect(cash.expenseOutIdr).toBe(300_000);
    expect(cash.outIdr).toBe(350_000);
    expect(cash.netIdr).toBe(650_000);
    expect(
      cash.outByCategory.find((r) => r.key === 'GUEST_REFUND')?.outIdr,
    ).toBe(50_000);
    expect(cash.outByCategory.find((r) => r.key === 'UTILITIES')?.outIdr).toBe(
      300_000,
    );
  });

  it('assembleCash netDeltaPct is null when previous net is 0', () => {
    const cash = assembleCash(
      [
        {
          period: 'primary',
          source: ReservationSource.MANUAL,
          unitTypeId: 't1',
          method: null,
          inIdr: 100,
          outIdr: 0,
        },
      ],
      inventory,
      true,
    );
    expect(cash.compare?.netIdr).toBe(0);
    expect(cash.compare?.netDeltaPct).toBeNull();
  });

  it('assembleOccupancy rolls units into types and property', () => {
    const { occupancy, occupancyByUnitType } = assembleOccupancy(
      inventory,
      [
        {
          period: 'primary',
          unitId: 'u1',
          source: ReservationSource.AIRBNB,
          nights: 10,
        },
        {
          period: 'primary',
          unitId: 'u2',
          source: ReservationSource.MANUAL,
          nights: 5,
        },
        {
          period: 'compare',
          unitId: 'u1',
          source: ReservationSource.AIRBNB,
          nights: 8,
        },
      ],
      [
        { period: 'primary', unitId: 'u1', nights: 2 },
        { period: 'compare', unitId: 'u1', nights: 1 },
      ],
      30,
      30,
      true,
    );

    expect(occupancy.occupiedNights).toBe(15);
    // u1 available = 30-2=28; u2 available = 30-0=30 → 58
    expect(occupancy.availableNights).toBe(58);
    expect(occupancy.occupancyPct).toBe(occupancyPct(15, 58));
    expect(occupancyByUnitType).toHaveLength(2);
    const deluxe = occupancyByUnitType.find((t) => t.unitTypeId === 't1');
    expect(deluxe?.units).toHaveLength(1);
    expect(deluxe?.occupiedNights).toBe(10);
    expect(deluxe?.units[0]?.compare?.occupiedNights).toBe(8);
  });

  it('assembleSourceMix always emits all sources with zeros', () => {
    const mix = assembleSourceMix(
      [
        {
          period: 'primary',
          unitId: 'u1',
          source: ReservationSource.AIRBNB,
          nights: 10,
        },
      ],
      [
        {
          period: 'primary',
          source: ReservationSource.AIRBNB,
          stays: 3,
        },
      ],
      10,
      0,
      false,
    );
    expect(mix).toHaveLength(5);
    expect(
      mix.find((r) => r.source === ReservationSource.AIRBNB),
    ).toMatchObject({
      nights: 10,
      staysCheckInInPeriod: 3,
      pctOfNights: 100,
    });
    expect(
      mix.find((r) => r.source === ReservationSource.WEBSITE)?.nights,
    ).toBe(0);
  });

  it('toInt handles Prisma Decimal-like objects from $queryRaw SUM', () => {
    const decimalLike = {
      toNumber() {
        return 59_550_000;
      },
    };
    expect(toInt(decimalLike)).toBe(59_550_000);
    expect(toInt(10n)).toBe(10);
    expect(toInt('42')).toBe(42);
    expect(toInt({})).toBe(0);
    expect(toInt(null)).toBe(0);
  });
});
