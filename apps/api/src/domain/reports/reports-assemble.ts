import {
  CollectedVia,
  PROPERTY_EXPENSE_CATEGORIES,
  ReservationSource,
  StaffReportsCashOutKind,
  type StaffReportsBilled,
  type StaffReportsCash,
  type StaffReportsCashMethodRow,
  type StaffReportsCashOutRow,
  type StaffReportsCashSourceRow,
  type StaffReportsCashUnitTypeRow,
  type StaffReportsOccupancy,
  type StaffReportsOccupancyByUnit,
  type StaffReportsOccupancyByUnitType,
  type StaffReportsSourceMixRow,
} from '@cabin/api-contract';

export type CashAggRow = {
  period: 'primary' | 'compare';
  source: string;
  unitTypeId: string | null;
  method: string | null;
  inIdr: number;
  outIdr: number;
};

export type StayClipRow = {
  period: 'primary' | 'compare';
  unitId: string;
  source: string;
  nights: number;
};

export type BlockClipRow = {
  period: 'primary' | 'compare';
  unitId: string;
  nights: number;
};

export type LandingRow = {
  period: 'primary' | 'compare';
  source: string;
  stays: number;
};

export type ExpenseAggRow = {
  period: 'primary' | 'compare';
  category: string;
  outIdr: number;
};

export type BilledTotals = {
  rentIdr: number;
  electricityIdr: number;
  waterIdr: number;
  maintenanceIdr: number;
  adminIdr: number;
};

export type InventoryUnit = {
  id: string;
  name: string;
  sortOrder: number;
  unitTypeId: string;
  unitTypeName: string;
  unitTypeSortOrder: number;
};

const ALL_SOURCES = Object.values(ReservationSource);
const ALL_METHODS: (CollectedVia | null)[] = [
  CollectedVia.PROPERTY,
  CollectedVia.CHANNEL,
  CollectedVia.MIXED,
  null,
];

function isDecimalLike(value: object): value is { toNumber: () => number } {
  return (
    'toNumber' in value &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  );
}

export function toInt(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  // Prisma `$queryRaw` SUM(bigint) → Decimal (`toNumber()`).
  if (value != null && typeof value === 'object' && isDecimalLike(value)) {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function occupancyPct(
  occupied: number,
  available: number,
): number | null {
  if (available <= 0) return null;
  return Math.round((occupied / available) * 1000) / 10;
}

export function occupancyPctDelta(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

function emptyCashBucket(): { inIdr: number; outIdr: number } {
  return { inIdr: 0, outIdr: 0 };
}

function netOf(b: { inIdr: number; outIdr: number }): number {
  return b.inIdr - b.outIdr;
}

export function emptyBilledTotals(): BilledTotals {
  return {
    rentIdr: 0,
    electricityIdr: 0,
    waterIdr: 0,
    maintenanceIdr: 0,
    adminIdr: 0,
  };
}

export function toStaffReportsBilled(
  totals: BilledTotals,
  compareTotals?: BilledTotals,
): StaffReportsBilled {
  const utilitiesIdr =
    totals.electricityIdr +
    totals.waterIdr +
    totals.maintenanceIdr +
    totals.adminIdr;
  const billed: StaffReportsBilled = {
    rentIdr: totals.rentIdr,
    electricityIdr: totals.electricityIdr,
    waterIdr: totals.waterIdr,
    maintenanceIdr: totals.maintenanceIdr,
    adminIdr: totals.adminIdr,
    utilitiesIdr,
    totalIdr: totals.rentIdr + utilitiesIdr,
  };
  if (compareTotals) {
    const prevUtils =
      compareTotals.electricityIdr +
      compareTotals.waterIdr +
      compareTotals.maintenanceIdr +
      compareTotals.adminIdr;
    billed.compare = {
      rentIdr: compareTotals.rentIdr,
      electricityIdr: compareTotals.electricityIdr,
      waterIdr: compareTotals.waterIdr,
      maintenanceIdr: compareTotals.maintenanceIdr,
      adminIdr: compareTotals.adminIdr,
      utilitiesIdr: prevUtils,
      totalIdr: compareTotals.rentIdr + prevUtils,
    };
  }
  return billed;
}

function outByCategoryRows(
  guestOutIdr: number,
  expenses: ExpenseAggRow[],
  period: 'primary' | 'compare',
): StaffReportsCashOutRow[] {
  const byCat = new Map<string, number>();
  for (const c of PROPERTY_EXPENSE_CATEGORIES) {
    byCat.set(c, 0);
  }
  for (const row of expenses) {
    if (row.period !== period) continue;
    byCat.set(row.category, (byCat.get(row.category) ?? 0) + row.outIdr);
  }
  const rows: StaffReportsCashOutRow[] = [
    { key: StaffReportsCashOutKind.GUEST_REFUND, outIdr: guestOutIdr },
  ];
  for (const c of PROPERTY_EXPENSE_CATEGORIES) {
    rows.push({ key: c, outIdr: byCat.get(c) ?? 0 });
  }
  return rows;
}

export function assembleCash(
  rows: CashAggRow[],
  inventory: InventoryUnit[],
  compare: boolean,
  expenses: ExpenseAggRow[] = [],
  billedPrimary: BilledTotals = emptyBilledTotals(),
  billedCompare: BilledTotals = emptyBilledTotals(),
): StaffReportsCash {
  const primary = rows.filter((r) => r.period === 'primary');
  const previous = rows.filter((r) => r.period === 'compare');

  const totals = (list: CashAggRow[]) => {
    let inIdr = 0;
    let outIdr = 0;
    for (const r of list) {
      inIdr += r.inIdr;
      outIdr += r.outIdr;
    }
    return { inIdr, outIdr, netIdr: inIdr - outIdr };
  };

  const bySourceMap = (list: CashAggRow[]) => {
    const map = new Map<string, { inIdr: number; outIdr: number }>();
    for (const s of ALL_SOURCES) map.set(s, emptyCashBucket());
    for (const r of list) {
      const b = map.get(r.source) ?? emptyCashBucket();
      b.inIdr += r.inIdr;
      b.outIdr += r.outIdr;
      map.set(r.source, b);
    }
    return map;
  };

  const byMethodMap = (list: CashAggRow[]) => {
    const map = new Map<string, { inIdr: number; outIdr: number }>();
    for (const m of ALL_METHODS) map.set(m ?? 'null', emptyCashBucket());
    for (const r of list) {
      const key = r.method ?? 'null';
      const b = map.get(key) ?? emptyCashBucket();
      b.inIdr += r.inIdr;
      b.outIdr += r.outIdr;
      map.set(key, b);
    }
    return map;
  };

  const typeMeta = new Map<
    string,
    { unitTypeId: string | null; name: string; sortOrder: number }
  >();
  for (const u of inventory) {
    if (!typeMeta.has(u.unitTypeId)) {
      typeMeta.set(u.unitTypeId, {
        unitTypeId: u.unitTypeId,
        name: u.unitTypeName,
        sortOrder: u.unitTypeSortOrder,
      });
    }
  }

  const byTypeMap = (list: CashAggRow[]) => {
    const map = new Map<string, { inIdr: number; outIdr: number }>();
    for (const id of typeMeta.keys()) map.set(id, emptyCashBucket());
    for (const r of list) {
      const key = r.unitTypeId ?? '__null__';
      if (!map.has(key) && r.unitTypeId == null) {
        typeMeta.set('__null__', {
          unitTypeId: null,
          name: 'Ungrouped',
          sortOrder: 99,
        });
        map.set(key, emptyCashBucket());
      }
      const b = map.get(key) ?? emptyCashBucket();
      b.inIdr += r.inIdr;
      b.outIdr += r.outIdr;
      map.set(key, b);
      if (!typeMeta.has(key) && r.unitTypeId != null) {
        typeMeta.set(key, {
          unitTypeId: r.unitTypeId,
          name: 'Unknown',
          sortOrder: 50,
        });
      }
    }
    return map;
  };

  const pTot = totals(primary);
  const cTot = totals(previous);
  const pSource = bySourceMap(primary);
  const pMethod = byMethodMap(primary);
  const pType = byTypeMap(primary);

  const expenseSum = (period: 'primary' | 'compare') => {
    let n = 0;
    for (const row of expenses) {
      if (row.period === period) n += row.outIdr;
    }
    return n;
  };
  const pExpense = expenseSum('primary');
  const cExpense = expenseSum('compare');
  const pOut = pTot.outIdr + pExpense;
  const cOut = cTot.outIdr + cExpense;
  const pNet = pTot.inIdr - pOut;
  const cNet = cTot.inIdr - cOut;

  const bySource: StaffReportsCashSourceRow[] = ALL_SOURCES.map((source) => {
    const b = pSource.get(source) ?? emptyCashBucket();
    return {
      source,
      inIdr: b.inIdr,
      outIdr: b.outIdr,
      netIdr: netOf(b),
    };
  });

  const byMethod: StaffReportsCashMethodRow[] = ALL_METHODS.map((method) => {
    const b = pMethod.get(method ?? 'null') ?? emptyCashBucket();
    return {
      method,
      inIdr: b.inIdr,
      outIdr: b.outIdr,
      netIdr: netOf(b),
    };
  });

  const byUnitType: StaffReportsCashUnitTypeRow[] = [...typeMeta.entries()]
    .map(([key, meta]) => {
      const b = pType.get(key) ?? emptyCashBucket();
      return {
        unitTypeId: meta.unitTypeId,
        name: meta.name,
        sortOrder: meta.sortOrder,
        inIdr: b.inIdr,
        outIdr: b.outIdr,
        netIdr: netOf(b),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const cash: StaffReportsCash = {
    inIdr: pTot.inIdr,
    outIdr: pOut,
    netIdr: pNet,
    guestInIdr: pTot.inIdr,
    guestOutIdr: pTot.outIdr,
    expenseOutIdr: pExpense,
    billed: toStaffReportsBilled(
      billedPrimary,
      compare ? billedCompare : undefined,
    ),
    outByCategory: outByCategoryRows(pTot.outIdr, expenses, 'primary'),
    bySource,
    byUnitType,
    byMethod,
  };

  if (compare) {
    const netDeltaIdr = pNet - cNet;
    cash.compare = {
      inIdr: cTot.inIdr,
      outIdr: cOut,
      netIdr: cNet,
      netDeltaIdr,
      netDeltaPct:
        cNet === 0
          ? null
          : Math.round((netDeltaIdr / Math.abs(cNet)) * 1000) / 10,
    };
  }

  return cash;
}

export function assembleOccupancy(
  inventory: InventoryUnit[],
  stayClips: StayClipRow[],
  blockClips: BlockClipRow[],
  periodNightsPrimary: number,
  periodNightsCompare: number,
  compare: boolean,
): {
  occupancy: StaffReportsOccupancy;
  occupancyByUnitType: StaffReportsOccupancyByUnitType[];
} {
  const occupiedByUnit = (period: 'primary' | 'compare') => {
    const map = new Map<string, number>();
    for (const row of stayClips) {
      if (row.period !== period) continue;
      map.set(row.unitId, (map.get(row.unitId) ?? 0) + row.nights);
    }
    return map;
  };

  const blockedByUnit = (period: 'primary' | 'compare') => {
    const map = new Map<string, number>();
    for (const row of blockClips) {
      if (row.period !== period) continue;
      map.set(row.unitId, (map.get(row.unitId) ?? 0) + row.nights);
    }
    return map;
  };

  const pOcc = occupiedByUnit('primary');
  const cOcc = occupiedByUnit('compare');
  const pBlk = blockedByUnit('primary');
  const cBlk = blockedByUnit('compare');

  const unitMetrics = (
    unitId: string,
    periodNights: number,
    occ: Map<string, number>,
    blk: Map<string, number>,
  ) => {
    const occupiedNights = occ.get(unitId) ?? 0;
    const blocked = blk.get(unitId) ?? 0;
    const availableNights = Math.max(0, periodNights - blocked);
    return {
      occupiedNights,
      availableNights,
      occupancyPct: occupancyPct(occupiedNights, availableNights),
    };
  };

  type TypeBucket = {
    unitTypeId: string;
    name: string;
    sortOrder: number;
    units: StaffReportsOccupancyByUnit[];
    occupiedNights: number;
    availableNights: number;
  };

  const types = new Map<string, TypeBucket>();

  for (const u of inventory) {
    const primary = unitMetrics(u.id, periodNightsPrimary, pOcc, pBlk);
    const unitRow: StaffReportsOccupancyByUnit = {
      unitId: u.id,
      name: u.name,
      sortOrder: u.sortOrder,
      ...primary,
    };
    if (compare) {
      const prev = unitMetrics(u.id, periodNightsCompare, cOcc, cBlk);
      unitRow.compare = {
        ...prev,
        occupancyPctDelta: occupancyPctDelta(
          primary.occupancyPct,
          prev.occupancyPct,
        ),
      };
    }

    let bucket = types.get(u.unitTypeId);
    if (!bucket) {
      bucket = {
        unitTypeId: u.unitTypeId,
        name: u.unitTypeName,
        sortOrder: u.unitTypeSortOrder,
        units: [],
        occupiedNights: 0,
        availableNights: 0,
      };
      types.set(u.unitTypeId, bucket);
    }
    bucket.units.push(unitRow);
    bucket.occupiedNights += primary.occupiedNights;
    bucket.availableNights += primary.availableNights;
  }

  const occupancyByUnitType: StaffReportsOccupancyByUnitType[] = [
    ...types.values(),
  ]
    .map((t) => {
      const pct = occupancyPct(t.occupiedNights, t.availableNights);
      const row: StaffReportsOccupancyByUnitType = {
        unitTypeId: t.unitTypeId,
        name: t.name,
        sortOrder: t.sortOrder,
        occupiedNights: t.occupiedNights,
        availableNights: t.availableNights,
        occupancyPct: pct,
        units: t.units.sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      };
      if (compare) {
        let prevOcc = 0;
        let prevAvail = 0;
        for (const u of t.units) {
          prevOcc += u.compare?.occupiedNights ?? 0;
          prevAvail += u.compare?.availableNights ?? 0;
        }
        const prevPct = occupancyPct(prevOcc, prevAvail);
        row.compare = {
          occupiedNights: prevOcc,
          availableNights: prevAvail,
          occupancyPct: prevPct,
          occupancyPctDelta: occupancyPctDelta(pct, prevPct),
        };
      }
      return row;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  let propOcc = 0;
  let propAvail = 0;
  for (const t of occupancyByUnitType) {
    propOcc += t.occupiedNights;
    propAvail += t.availableNights;
  }
  const propPct = occupancyPct(propOcc, propAvail);

  const occupancy: StaffReportsOccupancy = {
    occupiedNights: propOcc,
    availableNights: propAvail,
    occupancyPct: propPct,
  };

  if (compare) {
    let prevOcc = 0;
    let prevAvail = 0;
    for (const t of occupancyByUnitType) {
      prevOcc += t.compare?.occupiedNights ?? 0;
      prevAvail += t.compare?.availableNights ?? 0;
    }
    const prevPct = occupancyPct(prevOcc, prevAvail);
    occupancy.compare = {
      occupiedNights: prevOcc,
      availableNights: prevAvail,
      occupancyPct: prevPct,
      occupancyPctDelta: occupancyPctDelta(propPct, prevPct),
    };
  }

  return { occupancy, occupancyByUnitType };
}

export function assembleSourceMix(
  stayClips: StayClipRow[],
  landings: LandingRow[],
  propertyOccupiedPrimary: number,
  propertyOccupiedCompare: number,
  compare: boolean,
): StaffReportsSourceMixRow[] {
  const nightsBySource = (period: 'primary' | 'compare') => {
    const map = new Map<string, number>();
    for (const s of ALL_SOURCES) map.set(s, 0);
    for (const row of stayClips) {
      if (row.period !== period) continue;
      map.set(row.source, (map.get(row.source) ?? 0) + row.nights);
    }
    return map;
  };

  const staysBySource = (period: 'primary' | 'compare') => {
    const map = new Map<string, number>();
    for (const s of ALL_SOURCES) map.set(s, 0);
    for (const row of landings) {
      if (row.period !== period) continue;
      map.set(row.source, (map.get(row.source) ?? 0) + row.stays);
    }
    return map;
  };

  const pNights = nightsBySource('primary');
  const cNights = nightsBySource('compare');
  const pStays = staysBySource('primary');
  const cStays = staysBySource('compare');

  return ALL_SOURCES.map((source) => {
    const nights = pNights.get(source) ?? 0;
    const staysCheckInInPeriod = pStays.get(source) ?? 0;
    const pctOfNights =
      propertyOccupiedPrimary === 0
        ? 0
        : Math.round((nights / propertyOccupiedPrimary) * 1000) / 10;

    const row: StaffReportsSourceMixRow = {
      source,
      staysCheckInInPeriod,
      nights,
      pctOfNights,
    };

    if (compare) {
      const prevNights = cNights.get(source) ?? 0;
      const prevStays = cStays.get(source) ?? 0;
      const prevPct =
        propertyOccupiedCompare === 0
          ? 0
          : Math.round((prevNights / propertyOccupiedCompare) * 1000) / 10;
      row.compare = {
        staysCheckInInPeriod: prevStays,
        nights: prevNights,
        pctOfNights: prevPct,
        nightsDelta: nights - prevNights,
      };
    }

    return row;
  });
}
