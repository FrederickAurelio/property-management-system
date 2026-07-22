import type {
  StaffCalendarBlock,
  StaffCalendarStay,
  StaffCalendarUnit,
} from '@cabin/api-contract';
import type {
  CalendarBlock,
  Property,
  Reservation,
  Unit,
  UnitType,
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

type CalendarUnitRow = Unit & {
  unitType: Pick<UnitType, 'id' | 'name' | 'sortOrder'> | null;
};

type CalendarStayRow = Pick<
  Reservation,
  | 'id'
  | 'unitId'
  | 'source'
  | 'status'
  | 'checkInDate'
  | 'checkOutDate'
  | 'guestName'
  | 'totalAmountIdr'
  | 'paidAmountIdr'
  | 'paymentStatus'
  | 'collectedVia'
  | 'icalSyncWarning'
> & {
  property: Pick<Property, 'timezone'>;
};

export function toStaffCalendarUnit(row: CalendarUnitRow): StaffCalendarUnit {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    sortOrder: row.sortOrder,
    unitType: row.unitType
      ? {
          id: row.unitType.id,
          name: row.unitType.name,
          sortOrder: row.unitType.sortOrder,
        }
      : null,
  };
}

export function toStaffCalendarStay(row: CalendarStayRow): StaffCalendarStay {
  return {
    id: row.id,
    unitId: row.unitId,
    source: row.source,
    status: row.status,
    checkInDate: ymd(row.checkInDate),
    checkOutDate: ymd(row.checkOutDate),
    guestName: row.guestName,
    totalAmountIdr: bigintToNumber(row.totalAmountIdr),
    paidAmountIdr: Number(row.paidAmountIdr),
    paymentStatus: row.paymentStatus,
    collectedVia: row.collectedVia,
    icalSyncWarning: row.icalSyncWarning,
    propertyTimezone: row.property.timezone,
  };
}

export function toStaffCalendarBlock(row: CalendarBlock): StaffCalendarBlock {
  return {
    id: row.id,
    propertyId: row.propertyId,
    unitId: row.unitId,
    kind: row.kind,
    startDate: ymd(row.startDate),
    endDate: ymd(row.endDate),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export { ymd as calendarYmd };
