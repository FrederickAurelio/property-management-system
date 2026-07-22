import type {
  PaymentMovement as WirePaymentMovement,
  StaffReservation,
  StaffReservationListItem,
} from '@cabin/api-contract';
import type {
  Admin,
  PaymentMovement,
  Property,
  Reservation,
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
  createdByAdmin: Pick<Admin, 'username'> | null;
  updatedByAdmin: Pick<Admin, 'username'> | null;
  movements?: Array<
    PaymentMovement & {
      createdByAdmin: Pick<Admin, 'username'> | null;
    }
  >;
};

/** Lean Prisma shape for desk list — no admin joins / unused columns. */
export type ReservationListRow = Pick<
  Reservation,
  | 'id'
  | 'guestName'
  | 'checkInDate'
  | 'checkOutDate'
  | 'status'
  | 'source'
  | 'totalAmountIdr'
  | 'paidAmountIdr'
  | 'icalSyncWarning'
> & {
  property: Pick<Property, 'timezone'>;
  unit: Pick<Unit, 'code'>;
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
    createdAt: row.createdAt.toISOString(),
    createdByAdminId: row.createdByAdminId,
    createdByAdminUsername: row.createdByAdmin?.username ?? null,
  };
}

export function toStaffReservationListItem(
  row: ReservationListRow,
): StaffReservationListItem {
  return {
    id: row.id,
    guestName: row.guestName,
    unitCode: row.unit.code,
    checkInDate: ymd(row.checkInDate),
    checkOutDate: ymd(row.checkOutDate),
    status: row.status,
    source: row.source,
    totalAmountIdr: bigintToNumber(row.totalAmountIdr),
    paidAmountIdr: Number(row.paidAmountIdr),
    icalSyncWarning: row.icalSyncWarning,
    propertyTimezone: row.property.timezone,
  };
}

export function toStaffReservation(
  row: ReservationWithJoins,
  opts?: { includeMovements?: boolean },
): StaffReservation {
  const includeMovements = opts?.includeMovements ?? false;
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
    checkInDate: ymd(row.checkInDate),
    checkOutDate: ymd(row.checkOutDate),
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    guestCount: row.guestCount,
    notes: row.notes,
    totalAmountIdr: bigintToNumber(row.totalAmountIdr),
    paidAmountIdr: Number(row.paidAmountIdr),
    paymentStatus: row.paymentStatus,
    collectedVia: row.collectedVia,
    externalRef: row.externalRef,
    icalSyncWarning: row.icalSyncWarning,
    icalSyncWarnedAt: row.icalSyncWarnedAt?.toISOString() ?? null,
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
    ...(includeMovements && row.movements
      ? { movements: row.movements.map(toStaffPaymentMovement) }
      : {}),
  };
}

/** Parse YYYY-MM-DD to UTC Date at midnight for Prisma @db.Date. */
export function parseYmd(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export { todayYmdInTimezone } from '@cabin/api-contract';
