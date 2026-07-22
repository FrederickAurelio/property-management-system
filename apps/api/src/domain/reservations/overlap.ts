import {
  OCCUPYING_RESERVATION_STATUSES,
  type CalendarBlockKind,
  type ReservationStatus,
} from '@cabin/api-contract';
import type { Prisma, PrismaClient } from '../../generated/prisma/index.js';
import { parseYmd } from './reservations-mapper.js';

export type StayOverlapHit = {
  type: 'stay';
  id: string;
  guestName: string;
  source: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: ReservationStatus;
};

export type BlockOverlapHit = {
  type: 'block';
  id: string;
  kind: CalendarBlockKind;
  startDate: Date;
  endDate: Date;
};

export type OverlapHit = StayOverlapHit | BlockOverlapHit;

type DbClient = PrismaClient | Prisma.TransactionClient;

/** [checkIn, checkOut) overlap on same unit among occupying stays. */
export async function findStayOverlap(
  db: DbClient,
  input: {
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
    excludeReservationId?: string;
  },
): Promise<StayOverlapHit | null> {
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

  if (!hit) return null;
  return { type: 'stay', ...hit };
}

/** [start, end) overlap on same unit among calendar blocks. */
export async function findCalendarBlockOverlap(
  db: DbClient,
  input: {
    unitId: string;
    startDate: string;
    endDate: string;
    excludeBlockId?: string;
  },
): Promise<BlockOverlapHit | null> {
  const startDate = parseYmd(input.startDate);
  const endDate = parseYmd(input.endDate);

  const hit = await db.calendarBlock.findFirst({
    where: {
      unitId: input.unitId,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      ...(input.excludeBlockId ? { id: { not: input.excludeBlockId } } : {}),
    },
    select: {
      id: true,
      kind: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: 'asc' },
  });

  if (!hit) return null;
  return { type: 'block', ...hit };
}

/**
 * Occupying stay or calendar block overlapping [checkIn, checkOut) on the unit.
 * Prefers a stay hit when both exist.
 */
export async function findOccupyingOverlap(
  db: DbClient,
  input: {
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
    excludeReservationId?: string;
    excludeBlockId?: string;
  },
): Promise<OverlapHit | null> {
  const stay = await findStayOverlap(db, {
    unitId: input.unitId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    ...(input.excludeReservationId
      ? { excludeReservationId: input.excludeReservationId }
      : {}),
  });
  if (stay) return stay;

  return findCalendarBlockOverlap(db, {
    unitId: input.unitId,
    startDate: input.checkInDate,
    endDate: input.checkOutDate,
    ...(input.excludeBlockId ? { excludeBlockId: input.excludeBlockId } : {}),
  });
}

/** Unit ids that have an occupying stay or calendar block overlapping the range. */
export async function findBusyUnitIds(
  db: DbClient,
  input: {
    propertyId: string;
    checkInDate: string;
    checkOutDate: string;
    unitIds?: string[];
    excludeReservationId?: string;
    excludeBlockId?: string;
  },
): Promise<Set<string>> {
  const checkIn = parseYmd(input.checkInDate);
  const checkOut = parseYmd(input.checkOutDate);
  const unitFilter = input.unitIds ? { unitId: { in: input.unitIds } } : {};

  const [stayRows, blockRows] = await Promise.all([
    db.reservation.findMany({
      where: {
        propertyId: input.propertyId,
        status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
        ...unitFilter,
        ...(input.excludeReservationId
          ? { id: { not: input.excludeReservationId } }
          : {}),
      },
      select: { unitId: true },
      distinct: ['unitId'],
    }),
    db.calendarBlock.findMany({
      where: {
        propertyId: input.propertyId,
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
        ...unitFilter,
        ...(input.excludeBlockId ? { id: { not: input.excludeBlockId } } : {}),
      },
      select: { unitId: true },
      distinct: ['unitId'],
    }),
  ]);

  return new Set([
    ...stayRows.map((r) => r.unitId),
    ...blockRows.map((r) => r.unitId),
  ]);
}
