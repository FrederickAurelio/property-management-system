import { OCCUPYING_RESERVATION_STATUSES } from '@cabin/api-contract';
import type { PrismaClient } from '../../generated/prisma/index.js';

export type IcalBusyRange = {
  uid: string;
  startYmd: string;
  endYmd: string;
  kind: 'stay' | 'block';
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUtc(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Horizon: 30 days back → 24 months ahead (UTC date). */
export function icalBusyHorizon(now = new Date()): { from: Date; to: Date } {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return {
    from: addDaysUtc(today, -30),
    to: addDaysUtc(today, 730),
  };
}

export async function listUnitBusyRanges(
  db: PrismaClient,
  unitId: string,
): Promise<IcalBusyRange[]> {
  const { from, to } = icalBusyHorizon();

  const [stays, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        unitId,
        status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
        icalOverlapHold: false,
        checkInDate: { lt: to },
        checkOutDate: { gt: from },
      },
      select: { id: true, checkInDate: true, checkOutDate: true },
      orderBy: { checkInDate: 'asc' },
    }),
    db.calendarBlock.findMany({
      where: {
        unitId,
        startDate: { lt: to },
        endDate: { gt: from },
      },
      select: { id: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  return [
    ...stays.map((s) => ({
      uid: `stay-${s.id}@cabin-pms`,
      startYmd: ymd(s.checkInDate),
      endYmd: ymd(s.checkOutDate),
      kind: 'stay' as const,
    })),
    ...blocks.map((b) => ({
      uid: `block-${b.id}@cabin-pms`,
      startYmd: ymd(b.startDate),
      endYmd: ymd(b.endDate),
      kind: 'block' as const,
    })),
  ];
}
