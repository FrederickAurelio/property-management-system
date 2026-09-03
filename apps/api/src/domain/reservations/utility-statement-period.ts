import {
  UtilityKind,
  defaultNextUtilityReadingDateYmd,
  ymdYearMonth,
} from '@cabin/api-contract';

export type StatementMeterReading = {
  utility: string;
  readingDate: string;
  meterValue: number;
};

export type StatementFeeCharge = {
  chargeDate: string;
  amountIdr: number;
};

/** One billed month reconstructed the same way as the PMS utilities sheet. */
export type ReconstructedUtilityPeriod = {
  startDate: string;
  endDate: string;
  chargeYearMonth: string;
  elecStart: number | null;
  elecEnd: number | null;
  waterStart: number | null;
  waterEnd: number | null;
  maintenanceAmountIdr: number;
  adminAmountIdr: number;
};

function sortByDate<T extends { readingDate: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.readingDate < b.readingDate ? -1 : a.readingDate > b.readingDate ? 1 : 0,
  );
}

function sortByChargeDate<T extends { chargeDate: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.chargeDate < b.chargeDate ? -1 : a.chargeDate > b.chargeDate ? 1 : 0,
  );
}

function yearMonthOf(ymd: string): string {
  return ymdYearMonth(ymd) ?? ymd.slice(0, 7);
}

/**
 * Group saved readings + fees into billed periods (same zip as PMS `seedPeriods`).
 */
export function reconstructUtilityPeriods(input: {
  checkInDate: string;
  utilityReadings: ReadonlyArray<StatementMeterReading>;
  maintenanceCharges: ReadonlyArray<StatementFeeCharge>;
  adminCharges: ReadonlyArray<StatementFeeCharge>;
}): ReconstructedUtilityPeriod[] {
  const elec = sortByDate(
    input.utilityReadings.filter((r) => r.utility === UtilityKind.ELECTRICITY),
  );
  const water = sortByDate(
    input.utilityReadings.filter((r) => r.utility === UtilityKind.WATER),
  );
  const maint = sortByChargeDate([...input.maintenanceCharges]);
  const admin = sortByChargeDate([...input.adminCharges]);

  const hasAnyData =
    elec.length > 0 || water.length > 0 || maint.length > 0 || admin.length > 0;
  if (!hasAnyData) {
    return [];
  }

  const openingElec = elec[0];
  const openingWater = water[0];
  const elecEnds = elec.slice(1);
  const waterEnds = water.slice(1);
  const startDate =
    openingElec?.readingDate ?? openingWater?.readingDate ?? input.checkInDate;
  const intervalCount = Math.max(
    elecEnds.length,
    waterEnds.length,
    maint.length,
    admin.length,
  );
  const n = Math.max(intervalCount, 1);

  const periods: ReconstructedUtilityPeriod[] = [];
  let prevEndDate = startDate;
  let prevElecEnd: number | null = openingElec?.meterValue ?? null;
  let prevWaterEnd: number | null = openingWater?.meterValue ?? null;

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
    const elecStart = isFirst ? (openingElec?.meterValue ?? null) : prevElecEnd;
    const waterStart = isFirst
      ? (openingWater?.meterValue ?? null)
      : prevWaterEnd;
    const elecEnd = e?.meterValue ?? null;
    const waterEnd = w?.meterValue ?? null;

    periods.push({
      startDate: isFirst ? startDate : prevEndDate,
      endDate,
      chargeYearMonth,
      elecStart,
      elecEnd,
      waterStart,
      waterEnd,
      maintenanceAmountIdr: m ? Math.floor(m.amountIdr) : 0,
      adminAmountIdr: a ? Math.floor(a.amountIdr) : 0,
    });

    prevEndDate = endDate;
    prevElecEnd = elecEnd ?? prevElecEnd;
    prevWaterEnd = waterEnd ?? prevWaterEnd;
  }

  return periods;
}

export function periodHasBilledInterval(
  period: ReconstructedUtilityPeriod,
): boolean {
  const elec =
    period.elecStart != null &&
    period.elecEnd != null &&
    period.startDate.length > 0 &&
    period.endDate.length > 0;
  const water =
    period.waterStart != null &&
    period.waterEnd != null &&
    period.startDate.length > 0 &&
    period.endDate.length > 0;
  return elec || water;
}
