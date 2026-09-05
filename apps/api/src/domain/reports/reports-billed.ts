import {
  emptyUtilitySchemeSnapshot,
  lookupUtilityPeriodScheme,
  yearMonthOverlapsInclusiveRange,
  type UtilityAddon,
  type UtilityPeriodScheme,
  type UtilitySchemeSnapshot,
} from '@cabin/api-contract';
import {
  reconstructUtilityPeriods,
  type StatementFeeCharge,
  type StatementMeterReading,
} from '../reservations/utility-statement-period.js';
import { billUtilityPeriodMeters } from '../reservations/utility-statement-build.js';
import { asUtilityAddons } from '../reservations/reservations-mapper.js';
import { emptyBilledTotals, type BilledTotals } from './reports-assemble.js';

export type BilledStayInput = {
  checkInDate: string;
  utilityReadings: StatementMeterReading[];
  maintenanceCharges: StatementFeeCharge[];
  adminCharges: StatementFeeCharge[];
  periodSchemes: UtilityPeriodScheme[];
  fallbackScheme: UtilitySchemeSnapshot;
};

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fallbackSchemeFromStay(row: {
  electricityRateIdrPerKwh: number;
  waterRateIdrPerM3: number;
  maintenanceFeeIdrPerMonth: number;
  electricityMinKwh: number;
  adminFeeIdrPerMonth: number;
  utilityAddons: unknown;
}): UtilitySchemeSnapshot {
  const addons: UtilityAddon[] = asUtilityAddons(row.utilityAddons);
  const empty = emptyUtilitySchemeSnapshot();
  return {
    electricityRateIdrPerKwh: row.electricityRateIdrPerKwh,
    waterRateIdrPerM3: row.waterRateIdrPerM3,
    maintenanceFeeIdrPerMonth: row.maintenanceFeeIdrPerMonth,
    electricityMinKwh: row.electricityMinKwh,
    adminFeeIdrPerMonth: row.adminFeeIdrPerMonth,
    utilityAddons: addons.length > 0 ? addons : empty.utilityAddons,
  };
}

export function periodSchemeFromRow(row: {
  chargeDate: Date;
  electricityRateIdrPerKwh: number;
  waterRateIdrPerM3: number;
  maintenanceFeeIdrPerMonth: number;
  electricityMinKwh: number;
  adminFeeIdrPerMonth: number;
  utilityAddons: unknown;
}): UtilityPeriodScheme {
  return {
    chargeYearMonth: ymd(row.chargeDate).slice(0, 7),
    electricityRateIdrPerKwh: row.electricityRateIdrPerKwh,
    waterRateIdrPerM3: row.waterRateIdrPerM3,
    maintenanceFeeIdrPerMonth: row.maintenanceFeeIdrPerMonth,
    electricityMinKwh: row.electricityMinKwh,
    adminFeeIdrPerMonth: row.adminFeeIdrPerMonth,
    utilityAddons: asUtilityAddons(row.utilityAddons),
  };
}

export function billedStayFromRow(row: {
  checkInDate: Date;
  electricityRateIdrPerKwh: number;
  waterRateIdrPerM3: number;
  maintenanceFeeIdrPerMonth: number;
  electricityMinKwh: { toNumber?: () => number } | number;
  adminFeeIdrPerMonth: number;
  utilityAddons: unknown;
  utilityReadings: ReadonlyArray<{
    utility: string;
    readingDate: Date;
    meterValue: { toNumber?: () => number } | number;
  }>;
  maintenanceCharges: ReadonlyArray<{ chargeDate: Date; amountIdr: bigint }>;
  adminCharges: ReadonlyArray<{ chargeDate: Date; amountIdr: bigint }>;
  utilityPeriodSchemes: ReadonlyArray<{
    chargeDate: Date;
    electricityRateIdrPerKwh: number;
    waterRateIdrPerM3: number;
    maintenanceFeeIdrPerMonth: number;
    electricityMinKwh: { toNumber?: () => number } | number;
    adminFeeIdrPerMonth: number;
    utilityAddons: unknown;
  }>;
}): BilledStayInput {
  const minKwh =
    typeof row.electricityMinKwh === 'number'
      ? row.electricityMinKwh
      : (row.electricityMinKwh.toNumber?.() ?? 0);
  return {
    checkInDate: ymd(row.checkInDate),
    utilityReadings: row.utilityReadings.map((r) => ({
      utility: r.utility,
      readingDate: ymd(r.readingDate),
      meterValue:
        typeof r.meterValue === 'number'
          ? r.meterValue
          : (r.meterValue.toNumber?.() ?? 0),
    })),
    maintenanceCharges: row.maintenanceCharges.map((c) => ({
      chargeDate: ymd(c.chargeDate),
      amountIdr: Number(c.amountIdr),
    })),
    adminCharges: row.adminCharges.map((c) => ({
      chargeDate: ymd(c.chargeDate),
      amountIdr: Number(c.amountIdr),
    })),
    periodSchemes: row.utilityPeriodSchemes.map((s) =>
      periodSchemeFromRow({
        ...s,
        electricityMinKwh:
          typeof s.electricityMinKwh === 'number'
            ? s.electricityMinKwh
            : (s.electricityMinKwh.toNumber?.() ?? 0),
      }),
    ),
    fallbackScheme: fallbackSchemeFromStay({
      electricityRateIdrPerKwh: row.electricityRateIdrPerKwh,
      waterRateIdrPerM3: row.waterRateIdrPerM3,
      maintenanceFeeIdrPerMonth: row.maintenanceFeeIdrPerMonth,
      electricityMinKwh: minKwh,
      adminFeeIdrPerMonth: row.adminFeeIdrPerMonth,
      utilityAddons: row.utilityAddons,
    }),
  };
}

/**
 * Sum reconstructed utility periods whose billed month overlaps `[from, to]`.
 * Invalid meter intervals are skipped so one stay cannot 500 the report.
 */
export function sumBilledUtilitiesInRange(
  stays: ReadonlyArray<BilledStayInput>,
  from: string,
  to: string,
): BilledTotals {
  const totals = emptyBilledTotals();
  for (const stay of stays) {
    const periods = reconstructUtilityPeriods({
      checkInDate: stay.checkInDate,
      utilityReadings: stay.utilityReadings,
      maintenanceCharges: stay.maintenanceCharges,
      adminCharges: stay.adminCharges,
    });
    for (const period of periods) {
      if (!yearMonthOverlapsInclusiveRange(period.chargeYearMonth, from, to)) {
        continue;
      }
      totals.maintenanceIdr += period.maintenanceAmountIdr;
      totals.adminIdr += period.adminAmountIdr;
      try {
        const scheme = lookupUtilityPeriodScheme(
          stay.periodSchemes,
          period.chargeYearMonth,
          stay.fallbackScheme,
        );
        const billed = billUtilityPeriodMeters(period, scheme);
        totals.electricityIdr += billed.electricityAmountIdr;
        totals.waterIdr += billed.waterAmountIdr;
      } catch {
        // Skip meters; fees for this period already counted.
      }
    }
  }
  return totals;
}

export function withRentAccrual(
  utilities: BilledTotals,
  rentIdr: number,
): BilledTotals {
  return { ...utilities, rentIdr };
}
