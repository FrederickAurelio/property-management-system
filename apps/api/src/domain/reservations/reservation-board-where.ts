import {
  PaymentStatus,
  ReservationStatus,
  type ReservationSource,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { parseYmd } from './reservations-mapper.js';

/** Desk list select — shared by boards + dashboard. */
export const reservationListSelect = {
  id: true,
  guestName: true,
  billingPeriod: true,
  checkInDate: true,
  checkOutDate: true,
  status: true,
  source: true,
  totalAmountIdr: true,
  paidAmountIdr: true,
  paymentStatus: true,
  icalSyncWarning: true,
  icalOverlapHold: true,
  property: { select: { timezone: true } },
  unit: { select: { code: true } },
} as const;

/**
 * Arrivals board window (no property scope).
 * `CONFIRMED` + checkIn ≤ today < checkOut (overdue inclusive).
 */
export function arrivalsWindow(todayDate: Date): Prisma.ReservationWhereInput {
  return {
    status: ReservationStatus.CONFIRMED,
    checkInDate: { lte: todayDate },
    checkOutDate: { gt: todayDate },
  };
}

/**
 * Departures board window (no property scope).
 * `CHECKED_IN` + checkOut ≤ today (overdue inclusive).
 */
export function departuresWindow(
  todayDate: Date,
): Prisma.ReservationWhereInput {
  return {
    status: ReservationStatus.CHECKED_IN,
    checkOutDate: { lte: todayDate },
  };
}

export function arrivalsWhere(
  propertyId: string,
  todayDate: Date,
): Prisma.ReservationWhereInput {
  return {
    propertyId,
    ...arrivalsWindow(todayDate),
  };
}

export function departuresWhere(
  propertyId: string,
  todayDate: Date,
): Prisma.ReservationWhereInput {
  return {
    propertyId,
    ...departuresWindow(todayDate),
  };
}

/**
 * Balance-due / open-balance money OR (doc §3.1):
 * Due > 0 (UNPAID with total, or DEPOSIT) · or Refund > 0 (overpaid ids).
 */
export function openBalanceMoneyClause(
  overpaidIds: string[],
): Prisma.ReservationWhereInput {
  return {
    OR: [
      {
        paymentStatus: PaymentStatus.UNPAID,
        totalAmountIdr: { gt: 0 },
      },
      { paymentStatus: PaymentStatus.DEPOSIT },
      ...(overpaidIds.length > 0 ? [{ id: { in: overpaidIds } }] : []),
    ],
  };
}

export function withOpenBalanceMoney(
  base: Prisma.ReservationWhereInput,
  overpaidIds: string[],
): Prisma.ReservationWhereInput {
  return { AND: [base, openBalanceMoneyClause(overpaidIds)] };
}

export type OverpaidReservationFilters = {
  propertyId?: string;
  source?: ReservationSource;
  status?: ReservationStatus;
  checkInDate?: string;
  checkOutDate?: string;
  /** Inclusive stay-touch (requires both). */
  from?: string;
  to?: string;
  hasIcalWarning?: boolean;
  q?: string;
};

/** Refund > 0 rows — `paidAmountIdr > totalAmountIdr` in SQL. */
export async function findOverpaidReservationIds(
  prisma: PrismaService,
  filters: OverpaidReservationFilters = {},
): Promise<string[]> {
  const parts: Prisma.Sql[] = [
    Prisma.sql`r."totalAmountIdr" IS NOT NULL`,
    Prisma.sql`r."paidAmountIdr" > r."totalAmountIdr"`,
    Prisma.sql`r.status IN (
      'UNCONFIRMED'::"ReservationStatus",
      'CONFIRMED'::"ReservationStatus",
      'CHECKED_IN'::"ReservationStatus",
      'CHECKED_OUT'::"ReservationStatus"
    )`,
  ];

  if (filters.propertyId) {
    parts.push(Prisma.sql`r."propertyId" = ${filters.propertyId}`);
  }
  if (filters.source) {
    parts.push(Prisma.sql`r.source = ${filters.source}::"ReservationSource"`);
  }
  if (filters.status) {
    parts.push(Prisma.sql`r.status = ${filters.status}::"ReservationStatus"`);
  }
  if (filters.checkInDate) {
    parts.push(Prisma.sql`r."checkInDate" = ${parseYmd(filters.checkInDate)}`);
  }
  if (filters.checkOutDate) {
    parts.push(
      Prisma.sql`r."checkOutDate" = ${parseYmd(filters.checkOutDate)}`,
    );
  }
  if (filters.from && filters.to) {
    parts.push(Prisma.sql`r."checkInDate" <= ${parseYmd(filters.to)}`);
    parts.push(Prisma.sql`r."checkOutDate" >= ${parseYmd(filters.from)}`);
  }
  if (filters.hasIcalWarning) {
    parts.push(Prisma.sql`r."icalSyncWarning" IS NOT NULL`);
  }
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim()}%`;
    parts.push(Prisma.sql`(
      r."guestName" ILIKE ${q}
      OR r."guestEmail" ILIKE ${q}
      OR r."guestPhone" ILIKE ${q}
      OR r."externalRef" ILIKE ${q}
      OR u.code ILIKE ${q}
      OR p.name ILIKE ${q}
    )`);
  }

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT r.id
    FROM "Reservation" r
    LEFT JOIN "Unit" u ON u.id = r."unitId"
    LEFT JOIN "Property" p ON p.id = r."propertyId"
    WHERE ${Prisma.join(parts, ' AND ')}
  `;
  return rows.map((row) => row.id);
}

/**
 * Dashboard Needs attention — union of exception kinds, excluding
 * today's arrivals / departures windows (dedup).
 */
export function needsAttentionWhere(input: {
  propertyId: string;
  todayDate: Date;
  tomorrowDate: Date;
  overpaidIds: string[];
}): Prisma.ReservationWhereInput {
  const money = openBalanceMoneyClause(input.overpaidIds);
  return {
    propertyId: input.propertyId,
    AND: [
      {
        OR: [
          {
            AND: [
              {
                status: ReservationStatus.CHECKED_IN,
                checkOutDate: { gt: input.todayDate },
              },
              money,
            ],
          },
          {
            AND: [{ status: ReservationStatus.CHECKED_OUT }, money],
          },
          {
            status: ReservationStatus.CONFIRMED,
            checkOutDate: { lte: input.todayDate },
          },
          {
            status: ReservationStatus.UNCONFIRMED,
            checkInDate: { lte: input.tomorrowDate },
          },
          { icalSyncWarning: { not: null } },
        ],
      },
      {
        NOT: {
          OR: [
            arrivalsWindow(input.todayDate),
            departuresWindow(input.todayDate),
          ],
        },
      },
    ],
  };
}
