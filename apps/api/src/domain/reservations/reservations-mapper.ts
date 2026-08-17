import type {
  ArchiveItem,
  PaymentMovement as WirePaymentMovement,
  ReservationMaintenanceCharge as WireMaintenanceCharge,
  ReservationUtilityReading as WireUtilityReading,
  StaffReservation,
  StaffReservationListItem,
} from '@cabin/api-contract';
import {
  computeUtilitiesDueNotice,
  todayYmdInTimezone,
} from '@cabin/api-contract';
import type {
  Admin,
  PaymentMovement,
  Property,
  Reservation,
  ReservationMaintenanceCharge,
  ReservationUtilityReading,
  Unit,
} from '../../generated/prisma/index.js';

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function bigintToNumber(value: bigint | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value);
}

type ReservationWithJoins = Reservation & {
  property: Pick<Property, 'name' | 'timezone'>;
  unit: Pick<Unit, 'code'>;
  icalObservedUnit: Pick<Unit, 'code'> | null;
  createdByAdmin: Pick<Admin, 'username'> | null;
  updatedByAdmin: Pick<Admin, 'username'> | null;
  movements?: Array<
    PaymentMovement & {
      createdByAdmin: Pick<Admin, 'username'> | null;
    }
  >;
  utilityReadings?: ReservationUtilityReading[];
  maintenanceCharges?: ReservationMaintenanceCharge[];
};

/** Lean Prisma shape for desk list — no admin joins / unused columns. */
export type ReservationListRow = Pick<
  Reservation,
  | 'id'
  | 'guestName'
  | 'billingPeriod'
  | 'checkInDate'
  | 'checkOutDate'
  | 'createdAt'
  | 'status'
  | 'source'
  | 'totalAmountIdr'
  | 'paidAmountIdr'
  | 'paymentStatus'
  | 'icalSyncWarning'
  | 'icalOverlapHold'
> & {
  property: Pick<Property, 'timezone'>;
  unit: Pick<Unit, 'code'>;
  utilityReadings: Array<{ utility: string; readingDate: Date }>;
  maintenanceCharges: Array<{ chargeDate: Date }>;
};

export function toStaffPaymentMovement(
  row: PaymentMovement & {
    createdByAdmin: Pick<Admin, 'username'> | null;
  },
): WirePaymentMovement {
  return {
    id: row.id,
    reservationId: row.reservationId,
    direction: row.direction,
    kind: row.kind,
    amountIdr: Number(row.amountIdr),
    signedAmount: Number(row.signedAmount),
    method: row.method,
    note: row.note,
    proofImages: (row.proofImages as ArchiveItem[] | null) ?? [],
    createdAt: row.createdAt.toISOString(),
    createdByAdminId: row.createdByAdminId,
    createdByAdminUsername: row.createdByAdmin?.username ?? null,
  };
}

export function toStaffUtilityReading(
  row: ReservationUtilityReading,
): WireUtilityReading {
  return {
    id: row.id,
    reservationId: row.reservationId,
    utility: row.utility,
    readingDate: ymd(row.readingDate),
    meterValue: Number(row.meterValue),
    proofImages: (row.proofImages as ArchiveItem[] | null) ?? [],
    createdAt: row.createdAt.toISOString(),
    createdByAdminId: row.createdByAdminId,
  };
}

export function toStaffMaintenanceCharge(
  row: ReservationMaintenanceCharge,
): WireMaintenanceCharge {
  return {
    id: row.id,
    reservationId: row.reservationId,
    chargeDate: ymd(row.chargeDate),
    amountIdr: Number(row.amountIdr),
    createdAt: row.createdAt.toISOString(),
    createdByAdminId: row.createdByAdminId,
  };
}

export function toStaffReservationListItem(
  row: ReservationListRow,
): StaffReservationListItem {
  const { utilitiesDueNotice, utilitiesNextDueDate } =
    computeUtilitiesDueNoticeForRow(row);
  return {
    id: row.id,
    guestName: row.guestName,
    unitCode: row.unit.code,
    billingPeriod: row.billingPeriod,
    checkInDate: ymd(row.checkInDate),
    checkOutDate: ymd(row.checkOutDate),
    status: row.status,
    source: row.source,
    totalAmountIdr: bigintToNumber(row.totalAmountIdr),
    paidAmountIdr: Number(row.paidAmountIdr),
    paymentStatus: row.paymentStatus,
    icalSyncWarning: row.icalSyncWarning,
    icalOverlapHold: row.icalOverlapHold,
    propertyTimezone: row.property.timezone,
    utilitiesDueNotice,
    utilitiesNextDueDate,
  };
}

/** Shared inputs for `computeUtilitiesDueNotice` — detail + list stay in sync. */
function computeUtilitiesDueNoticeForRow(row: ReservationListRow): {
  utilitiesNextDueDate: string;
  utilitiesDueNotice: boolean;
} {
  return computeUtilitiesDueNotice({
    status: row.status,
    billingPeriod: row.billingPeriod,
    checkInDate: ymd(row.checkInDate),
    checkOutDate: ymd(row.checkOutDate),
    todayYmd: todayYmdInTimezone(row.property.timezone),
    electricityReadings: (row.utilityReadings ?? [])
      .filter((r) => r.utility === 'ELECTRICITY')
      .map((r) => ({ readingDate: ymd(r.readingDate) })),
    waterReadings: (row.utilityReadings ?? [])
      .filter((r) => r.utility === 'WATER')
      .map((r) => ({ readingDate: ymd(r.readingDate) })),
    maintenanceCharges: (row.maintenanceCharges ?? []).map((c) => ({
      chargeDate: ymd(c.chargeDate),
    })),
  });
}

export function toStaffReservation(
  row: ReservationWithJoins,
  opts?: {
    includeMovements?: boolean;
    includeUtilities?: boolean;
  },
): StaffReservation {
  const includeMovements = opts?.includeMovements ?? false;
  const includeUtilities = opts?.includeUtilities ?? false;
  const utilityReadings = row.utilityReadings ?? [];
  const maintenanceCharges = row.maintenanceCharges ?? [];
  const checkInDate = ymd(row.checkInDate);
  const checkOutDate = ymd(row.checkOutDate);
  const todayYmd = todayYmdInTimezone(row.property.timezone);
  const notice = computeUtilitiesDueNotice({
    status: row.status,
    billingPeriod: row.billingPeriod,
    checkInDate,
    checkOutDate,
    todayYmd,
    electricityReadings: utilityReadings
      .filter((r) => r.utility === 'ELECTRICITY')
      .map((r) => ({ readingDate: ymd(r.readingDate) })),
    waterReadings: utilityReadings
      .filter((r) => r.utility === 'WATER')
      .map((r) => ({ readingDate: ymd(r.readingDate) })),
    maintenanceCharges: maintenanceCharges.map((c) => ({
      chargeDate: ymd(c.chargeDate),
    })),
  });

  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.property.name,
    propertyTimezone: row.property.timezone,
    unitId: row.unitId,
    unitCode: row.unit.code,
    unitTypeId: row.unitTypeId,
    source: row.source,
    status: row.status,
    billingPeriod: row.billingPeriod,
    checkInDate,
    checkOutDate,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    guestCount: row.guestCount,
    notes: row.notes,
    totalAmountIdr: bigintToNumber(row.totalAmountIdr),
    rentAmountIdr: bigintToNumber(row.rentAmountIdr),
    electricityAmountIdr: Number(row.electricityAmountIdr),
    waterAmountIdr: Number(row.waterAmountIdr),
    maintenanceAmountIdr: Number(row.maintenanceAmountIdr),
    electricityRateIdrPerKwh: row.electricityRateIdrPerKwh,
    waterRateIdrPerM3: row.waterRateIdrPerM3,
    maintenanceFeeIdrPerMonth: row.maintenanceFeeIdrPerMonth,
    paidAmountIdr: Number(row.paidAmountIdr),
    paymentStatus: row.paymentStatus,
    collectedVia: row.collectedVia,
    externalRef: row.externalRef,
    icalSyncWarning: row.icalSyncWarning,
    icalSyncWarnedAt: row.icalSyncWarnedAt?.toISOString() ?? null,
    icalObservedUnitId: row.icalObservedUnitId,
    icalObservedUnitCode: row.icalObservedUnit?.code ?? null,
    icalObservedCheckInDate: row.icalObservedCheckInDate
      ? ymd(row.icalObservedCheckInDate)
      : null,
    icalObservedCheckOutDate: row.icalObservedCheckOutDate
      ? ymd(row.icalObservedCheckOutDate)
      : null,
    icalOverlapHold: row.icalOverlapHold,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
    checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByAdminId: row.createdByAdminId,
    updatedByAdminId: row.updatedByAdminId,
    createdByAdminUsername: row.createdByAdmin?.username ?? null,
    updatedByAdminUsername: row.updatedByAdmin?.username ?? null,
    utilitiesDueNotice: notice.utilitiesDueNotice,
    utilitiesNextDueDate: notice.utilitiesNextDueDate,
    ...(includeMovements && row.movements
      ? { movements: row.movements.map(toStaffPaymentMovement) }
      : {}),
    ...(includeUtilities
      ? {
          utilityReadings: utilityReadings.map(toStaffUtilityReading),
          maintenanceCharges: maintenanceCharges.map(toStaffMaintenanceCharge),
        }
      : {}),
  };
}

/** Parse YYYY-MM-DD to UTC Date at midnight for Prisma @db.Date. */
export function parseYmd(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export { todayYmdInTimezone } from '@cabin/api-contract';
