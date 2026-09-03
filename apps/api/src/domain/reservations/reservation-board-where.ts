import {
  PaymentStatus,
  ReservationStatus,
  StayBillingPeriod,
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
  createdAt: true,
  status: true,
  source: true,
  totalAmountIdr: true,
  paidAmountIdr: true,
  paymentStatus: true,
  icalSyncWarning: true,
  icalOverlapHold: true,
  property: { select: { timezone: true } },
  unit: { select: { code: true } },
  utilityReadings: { select: { utility: true, readingDate: true } },
  maintenanceCharges: { select: { chargeDate: true } },
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
 * Due > 0 (UNPAID with total, or DEPOSIT) · or Refund after CHECKED_OUT
 * (overpaid ids — occupying excess is credit, not a chase).
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
  /** Inclusive stay-touch start (`to` optional = open-ended). */
  from?: string;
  to?: string;
  billingPeriod?: StayBillingPeriod;
  hasIcalWarning?: boolean;
  q?: string;
};

/** Refund chase rows — overpaid and CHECKED_OUT (`paidAmountIdr > totalAmountIdr`). */
export async function findOverpaidReservationIds(
  prisma: PrismaService,
  filters: OverpaidReservationFilters = {},
): Promise<string[]> {
  const parts: Prisma.Sql[] = [
    Prisma.sql`r."totalAmountIdr" IS NOT NULL`,
    Prisma.sql`r."paidAmountIdr" > r."totalAmountIdr"`,
    Prisma.sql`r.status = 'CHECKED_OUT'::"ReservationStatus"`,
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
  } else if (filters.from) {
    parts.push(Prisma.sql`r."checkOutDate" >= ${parseYmd(filters.from)}`);
  }
  if (filters.billingPeriod) {
    parts.push(
      Prisma.sql`r."billingPeriod" = ${filters.billingPeriod}::"StayBillingPeriod"`,
    );
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

/**
 * Utilities-due membership — DB side, 1:1 with the contract helper
 * `computeUtilitiesDueNotice` (see design §6). The notice reduces to:
 *
 *   MONTHLY/YEARLY  ∧  CONFIRMED/CHECKED_IN  ∧  today < checkOut
 *   ∧  some month M in [month(checkIn)+1 .. month(today)] is NOT fully covered
 *      (missing an electricity reading, a water reading, or a maintenance charge)
 *
 * Prisma `where` cannot express this (a per-month cross-relation coverage test),
 * so it runs as `$queryRaw` — the repo-sanctioned fallback for predicates Prisma
 * cannot express (same as the `openAmount` sort). Returns matching id rows
 * ordered by checkOutDate asc, then createdAt asc (board order).
 */
export async function findUtilitiesDueReservationIds(
  prisma: PrismaService,
  opts: {
    propertyId?: string;
    source?: ReservationSource;
    billingPeriod?: StayBillingPeriod;
    q?: string;
    today: Date;
  },
): Promise<Array<{ id: string }>> {
  const parts: Prisma.Sql[] = [
    Prisma.sql`r."billingPeriod" IN (
      'MONTHLY'::"StayBillingPeriod", 'YEARLY'::"StayBillingPeriod"
    )`,
    Prisma.sql`r.status IN (
      'CONFIRMED'::"ReservationStatus", 'CHECKED_IN'::"ReservationStatus"
    )`,
    Prisma.sql`${opts.today} < r."checkOutDate"`,
    Prisma.sql`EXISTS (
      SELECT 1
      FROM generate_series(
        date_trunc('month', r."checkInDate") + interval '1 month',
        date_trunc('month', ${opts.today}::date),
        interval '1 month'
      ) AS m
      WHERE (
        NOT EXISTS (
          SELECT 1 FROM "ReservationUtilityReading" u
          WHERE u."reservationId" = r.id
            AND u.utility = 'ELECTRICITY'::"UtilityKind"
            AND date_trunc('month', u."readingDate") = m
        )
        OR NOT EXISTS (
          SELECT 1 FROM "ReservationUtilityReading" u
          WHERE u."reservationId" = r.id
            AND u.utility = 'WATER'::"UtilityKind"
            AND date_trunc('month', u."readingDate") = m
        )
        OR NOT EXISTS (
          SELECT 1 FROM "ReservationMaintenanceCharge" c
          WHERE c."reservationId" = r.id
            AND date_trunc('month', c."chargeDate") = m
        )
      )
    )`,
  ];

  if (opts.propertyId) {
    parts.push(Prisma.sql`r."propertyId" = ${opts.propertyId}`);
  }
  if (opts.source) {
    parts.push(Prisma.sql`r.source = ${opts.source}::"ReservationSource"`);
  }
  if (opts.billingPeriod) {
    parts.push(
      Prisma.sql`r."billingPeriod" = ${opts.billingPeriod}::"StayBillingPeriod"`,
    );
  }
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    parts.push(Prisma.sql`(
      r."guestName" ILIKE ${q}
      OR r."guestEmail" ILIKE ${q}
      OR r."guestPhone" ILIKE ${q}
      OR r."externalRef" ILIKE ${q}
      OR u.code ILIKE ${q}
      OR p.name ILIKE ${q}
    )`);
  }

  return prisma.$queryRaw<Array<{ id: string }>>`
    SELECT r.id
    FROM "Reservation" r
    LEFT JOIN "Unit" u ON u.id = r."unitId"
    LEFT JOIN "Property" p ON p.id = r."propertyId"
    WHERE ${Prisma.join(parts, ' AND ')}
    ORDER BY r."checkOutDate" ASC, r."createdAt" ASC
  `;
}
