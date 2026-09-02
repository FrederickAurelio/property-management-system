import {
  UtilityKind,
  defaultNextUtilityReadingDateYmd,
  yearMonthToChargeDateYmd,
  ymdYearMonth,
  type ArchiveItem,
  type MaintenanceChargeInput,
  type UtilityReadingInput,
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
  maintenanceFeeIdrPerMonth?: number;
};

export type FlattenedUtilities = {
  electricityReadings: UtilityReadingInput[];
  waterReadings: UtilityReadingInput[];
  maintenanceCharges: MaintenanceChargeInput[];
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

  const hasAnyData = elec.length > 0 || water.length > 0 || maint.length > 0;
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
  );
  const n = Math.max(intervalCount, 1);
  const isDraftSeed = !hasAnyData;

  const periods: UtilityPeriod[] = [];
  let prevEndDate = startDate;

  for (let i = 0; i < n; i++) {
    const e = elecEnds[i];
    const w = waterEnds[i];
    const m = maint[i];
    const isFirst = i === 0;
    const endDate =
      e?.readingDate ??
      w?.readingDate ??
      defaultNextUtilityReadingDateYmd(prevEndDate);
    const chargeYearMonth = m
      ? (ymdYearMonth(m.chargeDate) ?? m.chargeDate.slice(0, 7))
      : yearMonthOf(endDate);
    const amountDigits = m
      ? String(m.amountIdr)
      : isDraftSeed
        ? defaultFeeDigits(input.maintenanceFeeIdrPerMonth)
        : "";
    const key =
      e?.id ??
      w?.id ??
      m?.id ??
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
  options?: { maintenanceFeeIdrPerMonth?: number; createKey?: () => string },
): UtilityPeriod[] {
  const createKey = options?.createKey ?? createPeriodKey;
  const last = periods[periods.length - 1];
  const startDate = last?.endDate ?? "";
  const endDate = startDate ? defaultNextUtilityReadingDateYmd(startDate) : "";
  const lastElec = last?.elecEnd ?? emptyUtilityEnd();
  const lastWater = last?.waterEnd ?? emptyUtilityEnd();
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
      amountDigits: defaultFeeDigits(options?.maintenanceFeeIdrPerMonth),
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
  }

  return { electricityReadings, waterReadings, maintenanceCharges };
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

export function meterAmountIdr(
  usage: number | null,
  rateIdrPerUnit: number,
): number | null {
  if (usage == null || usage < 0) {
    return null;
  }
  const rate = Math.floor(rateIdrPerUnit);
  if (!Number.isFinite(rate) || rate < 0) {
    return null;
  }
  return Math.floor(usage * rate);
}

export function periodMaintAmountIdr(period: UtilityPeriod): number {
  if (period.amountDigits === "") {
    return 0;
  }
  const n = Number(period.amountDigits);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

export function periodSubtotalIdr(
  period: UtilityPeriod,
  elecRate: number,
  waterRate: number,
): number {
  const elec =
    meterAmountIdr(meterUsage(period.elecStart, period.elecEnd), elecRate) ?? 0;
  const water =
    meterAmountIdr(meterUsage(period.waterStart, period.waterEnd), waterRate) ??
    0;
  return elec + water + periodMaintAmountIdr(period);
}
