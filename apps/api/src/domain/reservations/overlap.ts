import {
  OCCUPYING_RESERVATION_STATUSES,
  type ReservationStatus,
} from '@cabin/api-contract';
import type { Prisma, PrismaClient } from '../../generated/prisma/index.js';
import { parseYmd } from './reservations-mapper.js';

export type OverlapHit = {
  id: string;
  guestName: string;
  source: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: ReservationStatus;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

/** [checkIn, checkOut) overlap on same unit among occupying statuses. */
export async function findOccupyingOverlap(
  db: DbClient,
  input: {
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
    excludeReservationId?: string;
  },
): Promise<OverlapHit | null> {
  const checkIn = parseYmd(input.checkInDate);
  const checkOut = parseYmd(input.checkOutDate);

  const hit = await db.reservation.findFirst({
    where: {
      unitId: input.unitId,
      status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
      ...(input.excludeReservationId
        ? { id: { not: input.excludeReservationId } }
        : {}),
    },
    select: {
      id: true,
      guestName: true,
      source: true,
      checkInDate: true,
      checkOutDate: true,
      status: true,
    },
    orderBy: { checkInDate: 'asc' },
  });

  return hit;
}

/** Unit ids that have an occupying stay overlapping the range. */
export async function findBusyUnitIds(
  db: DbClient,
  input: {
    propertyId: string;
    checkInDate: string;
    checkOutDate: string;
    unitIds?: string[];
    excludeReservationId?: string;
  },
): Promise<Set<string>> {
  const checkIn = parseYmd(input.checkInDate);
  const checkOut = parseYmd(input.checkOutDate);

  const rows = await db.reservation.findMany({
    where: {
      propertyId: input.propertyId,
      status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
      ...(input.unitIds ? { unitId: { in: input.unitIds } } : {}),
      ...(input.excludeReservationId
        ? { id: { not: input.excludeReservationId } }
        : {}),
    },
    select: { unitId: true },
    distinct: ['unitId'],
  });

  return new Set(rows.map((r) => r.unitId));
}
