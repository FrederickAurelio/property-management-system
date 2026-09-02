import { BadRequestException } from '@nestjs/common';
import {
  UtilityKind,
  applyUtilityAddons,
  computeMeterIntervalCharges,
  computeUtilityKindTotal,
  lookupUtilityPeriodScheme,
  type StaffReservation,
  type UtilityAddon,
  type UtilityAddonLine,
  type UtilitySchemeSnapshot,
  type UtilityStatementPayee,
} from '@cabin/api-contract';
import type { UtilityStatementFillInput } from './utility-statement-fill.js';
import { utilityStatementAmountDueIdr } from './utility-statement-layout.js';
import {
  periodHasBilledInterval,
  reconstructUtilityPeriods,
  type ReconstructedUtilityPeriod,
} from './utility-statement-period.js';

function addonsFor(
  scheme: UtilitySchemeSnapshot,
  kind: (typeof UtilityKind)[keyof typeof UtilityKind],
): UtilityAddon[] {
  return scheme.utilityAddons.filter((a) => a.utility === kind);
}

export function billUtilityInterval(
  start: number | null,
  end: number | null,
  startDate: string,
  endDate: string,
  rate: number,
  addons: ReadonlyArray<UtilityAddon>,
  options?: { minBilledUnits?: number },
): {
  usage: number;
  billedUnits: number;
  usageAmountIdr: number;
  kindTotalIdr: number;
  addonLines: UtilityAddonLine[];
} {
  const empty = {
    usage: 0,
    billedUnits: 0,
    usageAmountIdr: 0,
    kindTotalIdr: 0,
    addonLines: [] as UtilityAddonLine[],
  };
  if (start == null || end == null || !startDate || !endDate) {
    return empty;
  }
  const { intervals } = computeMeterIntervalCharges(
    [
      { readingDate: startDate, meterValue: start },
      { readingDate: endDate, meterValue: end },
    ],
    rate,
    options,
  );
  const interval = intervals[0];
  if (!interval) {
    return empty;
  }
  const applied = applyUtilityAddons(interval.amountIdr, addons);
  return {
    usage: interval.usage,
    billedUnits: interval.billedUnits,
    usageAmountIdr: interval.amountIdr,
    kindTotalIdr: computeUtilityKindTotal(interval.amountIdr, addons),
    addonLines: applied.lines,
  };
}

export function billUtilityPeriodMeters(
  period: ReconstructedUtilityPeriod,
  scheme: UtilitySchemeSnapshot,
): { electricityAmountIdr: number; waterAmountIdr: number } {
  const elec = billUtilityInterval(
    period.elecStart,
    period.elecEnd,
    period.startDate,
    period.endDate,
    scheme.electricityRateIdrPerKwh,
    addonsFor(scheme, UtilityKind.ELECTRICITY),
    { minBilledUnits: scheme.electricityMinKwh },
  );
  const water = billUtilityInterval(
    period.waterStart,
    period.waterEnd,
    period.startDate,
    period.endDate,
    scheme.waterRateIdrPerM3,
    addonsFor(scheme, UtilityKind.WATER),
  );
  return {
    electricityAmountIdr: elec.kindTotalIdr,
    waterAmountIdr: water.kindTotalIdr,
  };
}

export function utilityStatementBillingNo(
  reservationId: string,
  chargeYearMonth: string,
): string {
  const compact = reservationId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `US-${compact}-${chargeYearMonth}`;
}

export function utilityStatementFilename(
  unitCode: string,
  chargeYearMonth: string,
): string {
  const safeUnit = unitCode.replace(/[^\w.-]+/g, '_') || 'unit';
  return `utility-statement-${safeUnit}-${chargeYearMonth}.pdf`;
}

/**
 * Locked PDF math from the saved stay (not the dirty form).
 * Throws 400 when the month is unknown or has no billed meter interval.
 */
export function buildUtilityStatementFillInput(
  reservation: StaffReservation,
  chargeYearMonth: string,
  payee: UtilityStatementPayee,
): UtilityStatementFillInput {
  const periods = reconstructUtilityPeriods({
    checkInDate: reservation.checkInDate,
    utilityReadings: reservation.utilityReadings ?? [],
    maintenanceCharges: reservation.maintenanceCharges ?? [],
    adminCharges: reservation.adminCharges ?? [],
  });
  const period = periods.find((p) => p.chargeYearMonth === chargeYearMonth);
  if (!period || !periodHasBilledInterval(period)) {
    throw new BadRequestException('No billed utility interval for that month');
  }

  const scheme = lookupUtilityPeriodScheme(
    reservation.utilityPeriodSchemes,
    chargeYearMonth,
    reservation.billingUtilityScheme,
  );
  const electricityAddons = addonsFor(scheme, UtilityKind.ELECTRICITY);
  const waterAddons = addonsFor(scheme, UtilityKind.WATER);
  const elec = billUtilityInterval(
    period.elecStart,
    period.elecEnd,
    period.startDate,
    period.endDate,
    scheme.electricityRateIdrPerKwh,
    electricityAddons,
    { minBilledUnits: scheme.electricityMinKwh },
  );
  const water = billUtilityInterval(
    period.waterStart,
    period.waterEnd,
    period.startDate,
    period.endDate,
    scheme.waterRateIdrPerM3,
    waterAddons,
  );

  const periodSubtotalIdr =
    elec.kindTotalIdr + water.kindTotalIdr + period.maintenanceAmountIdr;
  const adminAmountIdr = period.adminAmountIdr;
  const dueAmountIdr = utilityStatementAmountDueIdr({
    periodSubtotalIdr,
    adminAmountIdr,
  });

  return {
    guestName: reservation.guestName,
    guestPhone: reservation.guestPhone?.trim() ?? '',
    unitCode: reservation.unitCode,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    billingNo: utilityStatementBillingNo(reservation.id, chargeYearMonth),
    statementDate: period.endDate,
    maintenanceAmountIdr: period.maintenanceAmountIdr,
    elecStartKwh: period.elecStart ?? 0,
    elecEndKwh: period.elecEnd ?? 0,
    elecActualUsage: elec.usage,
    elecBilledKwh: elec.billedUnits,
    elecRate: scheme.electricityRateIdrPerKwh,
    elecUsageAmountIdr: elec.usageAmountIdr,
    elecKindTotalIdr: elec.kindTotalIdr,
    elecAddonLines: elec.addonLines,
    waterStartM3: period.waterStart ?? 0,
    waterEndM3: period.waterEnd ?? 0,
    waterUsage: water.usage,
    waterRate: scheme.waterRateIdrPerM3,
    waterUsageAmountIdr: water.usageAmountIdr,
    waterKindTotalIdr: water.kindTotalIdr,
    waterAddonLines: water.addonLines,
    periodSubtotalIdr,
    adminAmountIdr,
    dueAmountIdr,
    bankName: payee.bankName,
    accountName: payee.accountName,
    accountNumber: payee.accountNumber,
  };
}
