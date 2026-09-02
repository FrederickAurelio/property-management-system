import {
  UtilityKind,
  applyUtilityAddons,
  cloneUtilitySchemeSnapshot,
  computeMeterIntervalCharges,
  computeUtilityKindTotal,
  defaultNextUtilityReadingDateYmd,
  emptyUtilitySchemeSnapshot,
  yearMonthToChargeDateYmd,
  ymdYearMonth,
  type ArchiveItem,
  type AdminChargeInput,
  type MaintenanceChargeInput,
  type UtilityAddon,
  type UtilityAddonLine,
  type UtilityPeriodScheme,
  type UtilityReadingInput,
  type UtilitySchemeSnapshot,
} from "@cabin/api-contract";
import { plainFromMeterValue } from "@/lib/decimal-input";

export type UtilityEnd = {
  meterDigits: string;
  proofImages: ArchiveItem[];
};

export type UtilityPeriod = {
  key: string;
  startDate: string;
  endDate: string;
  elecStart: UtilityEnd;
  waterStart: UtilityEnd;
  elecEnd: UtilityEnd;
  waterEnd: UtilityEnd;
  /** Calendar month `YYYY-MM` (desk); API stores as 1st of month. */
  chargeYearMonth: string;
  amountDigits: string;
  /** Admin fee IDR for this billed month (same month as maintenance). */
  adminDigits: string;
  scheme: UtilitySchemeSnapshot;
};

export type SeedUtilityReading = {
  id?: string;
  utility: UtilityKind;
  readingDate: string;
  meterValue: number;
  proofImages?: ArchiveItem[];
};

export type SeedMaintenanceCharge = {
  id?: string;
  chargeDate: string;
  amountIdr: number;
};

export type SeedUtilitiesInput = {
  checkInDate: string;
  utilityReadings?: SeedUtilityReading[];
  maintenanceCharges?: SeedMaintenanceCharge[];
  adminCharges?: SeedMaintenanceCharge[];
  fallbackScheme: UtilitySchemeSnapshot;
  utilityPeriodSchemes?: UtilityPeriodScheme[];
};

/** Map reservation detail → period seed input (uses effective billing scheme). */
export function utilitiesSeedInput(reservation: {
  checkInDate: string;
  utilityReadings?: SeedUtilityReading[];
  maintenanceCharges?: SeedMaintenanceCharge[];
  adminCharges?: SeedMaintenanceCharge[];
  billingUtilityScheme: UtilitySchemeSnapshot;
  utilityPeriodSchemes?: UtilityPeriodScheme[];
}): SeedUtilitiesInput {
  return {
    checkInDate: reservation.checkInDate,
    utilityReadings: reservation.utilityReadings,
    maintenanceCharges: reservation.maintenanceCharges,
    adminCharges: reservation.adminCharges,
    fallbackScheme: cloneUtilitySchemeSnapshot(
      reservation.billingUtilityScheme,
    ),
    utilityPeriodSchemes: reservation.utilityPeriodSchemes,
  };
}

export type FlattenedUtilities = {
  electricityReadings: UtilityReadingInput[];
  waterReadings: UtilityReadingInput[];
  maintenanceCharges: MaintenanceChargeInput[];
  adminCharges: AdminChargeInput[];
  periodSchemes: UtilityPeriodScheme[];
};

export type PeriodKindPreview = {
  usage: number | null;
  billedUnits: number | null;
  minApplied: boolean;
  usageAmountIdr: number | null;
  addonLines: UtilityAddonLine[];
  kindTotalIdr: number | null;
};

export function emptyUtilityEnd(): UtilityEnd {
  return { meterDigits: "", proofImages: [] };
}

export function copyUtilityEnd(
  end: UtilityEnd,
  opts?: { proofs?: boolean },
): UtilityEnd {
  return {
    meterDigits: end.meterDigits,
    proofImages: opts?.proofs === false ? [] : [...end.proofImages],
  };
}

export function createPeriodKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortByDate<T extends { readingDate: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.readingDate < b.readingDate ? -1 : a.readingDate > b.readingDate ? 1 : 0,
  );
}

function sortMaint<T extends { chargeDate: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.chargeDate < b.chargeDate ? -1 : a.chargeDate > b.chargeDate ? 1 : 0,
  );
}

function readingToEnd(row: SeedUtilityReading | undefined): UtilityEnd {
  if (!row) {
    return emptyUtilityEnd();
  }
  return {
    meterDigits: plainFromMeterValue(Number(row.meterValue)),
    proofImages: row.proofImages ?? [],
  };
}

function yearMonthOf(ymd: string): string {
  return ymdYearMonth(ymd) ?? ymd.slice(0, 7);
}

function defaultFeeDigits(fee: number | undefined): string {
  if (fee == null || !Number.isFinite(fee) || fee <= 0) {
    return "";
  }
  return String(Math.floor(fee));
}

function schemeForMonth(
  input: SeedUtilitiesInput,
  chargeYearMonth: string,
): UtilitySchemeSnapshot {
  const hit = (input.utilityPeriodSchemes ?? []).find(
    (row) => row.chargeYearMonth === chargeYearMonth,
  );
  if (hit) {
    return cloneUtilitySchemeSnapshot(hit);
  }
  return cloneUtilitySchemeSnapshot(
    input.fallbackScheme ?? emptyUtilitySchemeSnapshot(),
  );
}

export function applyPeriodScheme(
  period: UtilityPeriod,
  scheme: UtilitySchemeSnapshot,
): UtilityPeriod {
  const next = cloneUtilitySchemeSnapshot(scheme);
  return {
    ...period,
    scheme: next,
    amountDigits: defaultFeeDigits(next.maintenanceFeeIdrPerMonth),
    adminDigits: defaultFeeDigits(next.adminFeeIdrPerMonth),
  };
}

/**
 * Group GET readings + maintenance into billed periods.
 * Always returns at least one period (draft start+end for a new stay).
 */
export function seedPeriods(
  input: SeedUtilitiesInput,
  options?: { createKey?: () => string },
): UtilityPeriod[] {
  const createKey = options?.createKey ?? createPeriodKey;
  const elec = sortByDate(
    (input.utilityReadings ?? []).filter(
      (r) => r.utility === UtilityKind.ELECTRICITY,
    ),
  );
  const water = sortByDate(
    (input.utilityReadings ?? []).filter(
      (r) => r.utility === UtilityKind.WATER,
    ),
  );
  const maint = sortMaint(input.maintenanceCharges ?? []);
  const admin = sortMaint(input.adminCharges ?? []);

  const hasAnyData =
    elec.length > 0 || water.length > 0 || maint.length > 0 || admin.length > 0;
  const openingElec = elec[0];
  const openingWater = water[0];
  const elecEnds = elec.slice(1);
  const waterEnds = water.slice(1);

  const startDate =
    openingElec?.readingDate ?? openingWater?.readingDate ?? input.checkInDate;
  const elecStart = readingToEnd(openingElec);
  const waterStart = readingToEnd(openingWater);

  const intervalCount = Math.max(
    elecEnds.length,
    waterEnds.length,
    maint.length,
    admin.length,
  );
  const n = Math.max(intervalCount, 1);
  const isDraftSeed = !hasAnyData;

  const periods: UtilityPeriod[] = [];
  let prevEndDate = startDate;

  for (let i = 0; i < n; i++) {
    const e = elecEnds[i];
    const w = waterEnds[i];
    const m = maint[i];
    const a = admin[i];
    const isFirst = i === 0;
    const endDate =
      e?.readingDate ??
      w?.readingDate ??
      defaultNextUtilityReadingDateYmd(prevEndDate);
    const chargeYearMonth = m
      ? (ymdYearMonth(m.chargeDate) ?? m.chargeDate.slice(0, 7))
      : a
        ? (ymdYearMonth(a.chargeDate) ?? a.chargeDate.slice(0, 7))
        : yearMonthOf(endDate);
    const scheme = schemeForMonth(input, chargeYearMonth);
    const amountDigits = m
      ? String(m.amountIdr)
      : isDraftSeed
        ? defaultFeeDigits(scheme.maintenanceFeeIdrPerMonth)
        : "";
    const adminDigits = a
      ? String(a.amountIdr)
      : isDraftSeed
        ? defaultFeeDigits(scheme.adminFeeIdrPerMonth)
        : "";
    const key =
      e?.id ??
      w?.id ??
      m?.id ??
      a?.id ??
      (isFirst ? (openingElec?.id ?? openingWater?.id) : undefined) ??
      createKey();

    periods.push({
      key,
      startDate: isFirst ? startDate : prevEndDate,
      endDate,
      elecStart: isFirst ? elecStart : emptyUtilityEnd(),
      waterStart: isFirst ? waterStart : emptyUtilityEnd(),
      elecEnd: readingToEnd(e),
      waterEnd: readingToEnd(w),
      chargeYearMonth,
      amountDigits,
      adminDigits,
      scheme,
    });

    prevEndDate = endDate;
  }

  return rechainStarts(periods);
}

/** Period N+1 start is always period N end (meters + date). Period 0 start is independent. */
export function rechainStarts(periods: UtilityPeriod[]): UtilityPeriod[] {
  return periods.map((period, index) => {
    if (index === 0) {
      return period;
    }
    const prev = periods[index - 1]!;
    return {
      ...period,
      startDate: prev.endDate,
      elecStart: copyUtilityEnd(prev.elecEnd),
      waterStart: copyUtilityEnd(prev.waterEnd),
    };
  });
}

export function patchPeriod(
  periods: UtilityPeriod[],
  index: number,
  patch: Partial<UtilityPeriod>,
): UtilityPeriod[] {
  const next = periods.map((period, i) =>
    i === index ? { ...period, ...patch } : period,
  );
  return rechainStarts(next);
}

export function addPeriod(
  periods: UtilityPeriod[],
  options?: {
    scheme?: UtilitySchemeSnapshot;
    createKey?: () => string;
  },
): UtilityPeriod[] {
  const createKey = options?.createKey ?? createPeriodKey;
  const last = periods[periods.length - 1];
  const startDate = last?.endDate ?? "";
  const endDate = startDate ? defaultNextUtilityReadingDateYmd(startDate) : "";
  const lastElec = last?.elecEnd ?? emptyUtilityEnd();
  const lastWater = last?.waterEnd ?? emptyUtilityEnd();
  const scheme = cloneUtilitySchemeSnapshot(
    options?.scheme ?? last?.scheme ?? emptyUtilitySchemeSnapshot(),
  );
  return [
    ...periods,
    {
      key: createKey(),
      startDate,
      endDate,
      elecStart: copyUtilityEnd(lastElec),
      waterStart: copyUtilityEnd(lastWater),
      elecEnd: copyUtilityEnd(lastElec, { proofs: false }),
      waterEnd: copyUtilityEnd(lastWater, { proofs: false }),
      chargeYearMonth: endDate ? yearMonthOf(endDate) : "",
      amountDigits: defaultFeeDigits(scheme.maintenanceFeeIdrPerMonth),
      adminDigits: defaultFeeDigits(scheme.adminFeeIdrPerMonth),
      scheme,
    },
  ];
}

export function deletePeriod(
  periods: UtilityPeriod[],
  index: number,
): UtilityPeriod[] {
  if (periods.length <= 1) {
    return periods;
  }
  const removed = periods[index];
  const next = periods.filter((_, i) => i !== index);
  if (index === 0 && removed && next[0]) {
    next[0] = {
      ...next[0],
      startDate: removed.startDate,
      elecStart: copyUtilityEnd(removed.elecStart),
      waterStart: copyUtilityEnd(removed.waterStart),
    };
  }
  return rechainStarts(next);
}

function toReading(
  utility: UtilityKind,
  readingDate: string,
  end: UtilityEnd,
): UtilityReadingInput | null {
  if (!readingDate || end.meterDigits === "") {
    return null;
  }
  const meterValue = Number(end.meterDigits);
  if (!Number.isFinite(meterValue) || meterValue < 0) {
    return null;
  }
  return {
    utility,
    readingDate,
    meterValue,
    proofImages: end.proofImages,
  };
}

/**
 * Flatten periods to the PUT replace-set.
 * Opening meters come from period 0 start; each period end is one reading date
 * shared by electricity and water.
 */
export function flattenPeriods(periods: UtilityPeriod[]): FlattenedUtilities {
  const electricityReadings: UtilityReadingInput[] = [];
  const waterReadings: UtilityReadingInput[] = [];
  const first = periods[0];
  if (first) {
    const elecOpen = toReading(
      UtilityKind.ELECTRICITY,
      first.startDate,
      first.elecStart,
    );
    const waterOpen = toReading(
      UtilityKind.WATER,
      first.startDate,
      first.waterStart,
    );
    if (elecOpen) {
      electricityReadings.push(elecOpen);
    }
    if (waterOpen) {
      waterReadings.push(waterOpen);
    }
  }

  const maintenanceCharges: MaintenanceChargeInput[] = [];
  const adminCharges: AdminChargeInput[] = [];
  const periodSchemes: UtilityPeriodScheme[] = [];
  for (const period of periods) {
    const elecEnd = toReading(
      UtilityKind.ELECTRICITY,
      period.endDate,
      period.elecEnd,
    );
    const waterEnd = toReading(
      UtilityKind.WATER,
      period.endDate,
      period.waterEnd,
    );
    if (elecEnd) {
      electricityReadings.push(elecEnd);
    }
    if (waterEnd) {
      waterReadings.push(waterEnd);
    }
    if (period.chargeYearMonth && period.amountDigits !== "") {
      const amountIdr = Math.floor(Number(period.amountDigits));
      if (Number.isFinite(amountIdr) && amountIdr >= 0) {
        maintenanceCharges.push({
          chargeDate: yearMonthToChargeDateYmd(period.chargeYearMonth),
          amountIdr,
        });
      }
    }
    if (period.chargeYearMonth && period.adminDigits !== "") {
      const amountIdr = Math.floor(Number(period.adminDigits));
      if (Number.isFinite(amountIdr) && amountIdr >= 0) {
        adminCharges.push({
          chargeDate: yearMonthToChargeDateYmd(period.chargeYearMonth),
          amountIdr,
        });
      }
    }
    if (period.chargeYearMonth) {
      periodSchemes.push({
        chargeYearMonth: period.chargeYearMonth,
        ...cloneUtilitySchemeSnapshot(period.scheme),
      });
    }
  }

  return {
    electricityReadings,
    waterReadings,
    maintenanceCharges,
    adminCharges,
    periodSchemes,
  };
}

export function meterUsage(start: UtilityEnd, end: UtilityEnd): number | null {
  if (start.meterDigits === "" || end.meterDigits === "") {
    return null;
  }
  const from = Number(start.meterDigits);
  const to = Number(end.meterDigits);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }
  return to - from;
}

const EMPTY_KIND_PREVIEW: PeriodKindPreview = {
  usage: null,
  billedUnits: null,
  minApplied: false,
  usageAmountIdr: null,
  addonLines: [],
  kindTotalIdr: null,
};

/** One billed interval via contract helpers (min + add-ons). */
export function periodKindPreview(
  start: UtilityEnd,
  end: UtilityEnd,
  startDate: string,
  endDate: string,
  rate: number,
  addons: ReadonlyArray<UtilityAddon>,
  options?: { minBilledUnits?: number },
): PeriodKindPreview {
  const usage = meterUsage(start, end);
  if (
    !startDate ||
    !endDate ||
    start.meterDigits === "" ||
    end.meterDigits === ""
  ) {
    return { ...EMPTY_KIND_PREVIEW, usage };
  }
  const startMeter = Number(start.meterDigits);
  const endMeter = Number(end.meterDigits);
  if (!Number.isFinite(startMeter) || !Number.isFinite(endMeter)) {
    return { ...EMPTY_KIND_PREVIEW, usage };
  }
  try {
    const { intervals } = computeMeterIntervalCharges(
      [
        { readingDate: startDate, meterValue: startMeter },
        { readingDate: endDate, meterValue: endMeter },
      ],
      rate,
      options,
    );
    const interval = intervals[0];
    if (!interval) {
      return { ...EMPTY_KIND_PREVIEW, usage };
    }
    const applied = applyUtilityAddons(interval.amountIdr, addons);
    const minRaw = options?.minBilledUnits;
    const minBilled =
      minRaw != null && Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 0;
    return {
      usage: interval.usage,
      billedUnits: interval.billedUnits,
      minApplied: minBilled > 0 && interval.billedUnits > interval.usage,
      usageAmountIdr: interval.amountIdr,
      addonLines: applied.lines,
      kindTotalIdr: computeUtilityKindTotal(interval.amountIdr, addons),
    };
  } catch {
    return { ...EMPTY_KIND_PREVIEW, usage };
  }
}

/** Sum of kind totals across all intervals (matches Nest PUT denorm). */
export function utilitiesKindTotalIdr(
  readings: ReadonlyArray<{ readingDate: string; meterValue: number }>,
  rate: number,
  addons: ReadonlyArray<UtilityAddon>,
  options?: { minBilledUnits?: number },
): number {
  const { intervals } = computeMeterIntervalCharges(readings, rate, options);
  let total = 0;
  for (const interval of intervals) {
    total += computeUtilityKindTotal(interval.amountIdr, addons);
  }
  return total;
}

export function periodMaintAmountIdr(period: UtilityPeriod): number {
  return feeDigitsToIdr(period.amountDigits);
}

export function periodAdminAmountIdr(period: UtilityPeriod): number {
  return feeDigitsToIdr(period.adminDigits);
}

function feeDigitsToIdr(digits: string): number {
  if (digits === "") {
    return 0;
  }
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

export function periodSubtotalIdr(period: UtilityPeriod): number {
  const scheme = period.scheme;
  const electricityAddons = scheme.utilityAddons.filter(
    (addon) => addon.utility === UtilityKind.ELECTRICITY,
  );
  const waterAddons = scheme.utilityAddons.filter(
    (addon) => addon.utility === UtilityKind.WATER,
  );
  const elec = periodKindPreview(
    period.elecStart,
    period.elecEnd,
    period.startDate,
    period.endDate,
    scheme.electricityRateIdrPerKwh,
    electricityAddons,
    { minBilledUnits: scheme.electricityMinKwh },
  );
  const water = periodKindPreview(
    period.waterStart,
    period.waterEnd,
    period.startDate,
    period.endDate,
    scheme.waterRateIdrPerM3,
    waterAddons,
  );
  return (
    (elec.kindTotalIdr ?? 0) +
    (water.kindTotalIdr ?? 0) +
    periodMaintAmountIdr(period) +
    periodAdminAmountIdr(period)
  );
}
