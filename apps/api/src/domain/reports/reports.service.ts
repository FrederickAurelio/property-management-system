import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  REPORTS_MAX_INCLUSIVE_DAYS,
  REPORTS_OCCUPANCY_STATUSES,
  UnitStatus,
  addDaysYmd,
  inclusiveDayCount,
  previousEqualPeriod,
  ymdInclusiveToUtcHalfOpen,
  type StaffReportsSummary,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ReportsSummaryQueryDto } from './dto/reports-summary.query.dto.js';
import {
  assembleCash,
  assembleOccupancy,
  assembleSourceMix,
  toInt,
  type BlockClipRow,
  type CashAggRow,
  type InventoryUnit,
  type LandingRow,
  type StayClipRow,
} from './reports-assemble.js';

function parseYmdDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    query: ReportsSummaryQueryDto,
  ): Promise<StaffReportsSummary> {
    const compare = query.compare !== false;
    const { propertyId, from, to } = query;

    if (from > to) {
      throw new BadRequestException('from must be on or before to');
    }
    const days = inclusiveDayCount(from, to);
    if (days > REPORTS_MAX_INCLUSIVE_DAYS) {
      throw new BadRequestException(
        `Period cannot exceed ${REPORTS_MAX_INCLUSIVE_DAYS} days`,
      );
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, timezone: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const tz = property.timezone || 'Asia/Jakarta';
    const compareWindow = compare ? previousEqualPeriod(from, to) : null;
    const primaryUtc = ymdInclusiveToUtcHalfOpen(from, to, tz);
    const compareUtc = compareWindow
      ? ymdInclusiveToUtcHalfOpen(compareWindow.from, compareWindow.to, tz)
      : null;

    const spanStart = compareUtc ? compareUtc.start : primaryUtc.start;
    const spanEnd = primaryUtc.endExclusive;

    const periodNightsPrimary = days;
    const periodNightsCompare = compareWindow
      ? inclusiveDayCount(compareWindow.from, compareWindow.to)
      : 0;

    const toExclusivePrimary = addDaysYmd(to, 1);
    const toExclusiveCompare = compareWindow
      ? addDaysYmd(compareWindow.to, 1)
      : null;

    const [cashRows, stayClips, blockClips, landings, inventory] =
      await Promise.all([
        this.queryCashAgg(
          propertyId,
          spanStart,
          spanEnd,
          primaryUtc.start,
          primaryUtc.endExclusive,
          compareUtc?.start ?? null,
          compareUtc?.endExclusive ?? null,
        ),
        this.queryStayClips(
          propertyId,
          from,
          toExclusivePrimary,
          compareWindow?.from ?? null,
          toExclusiveCompare,
        ),
        this.queryBlockClips(
          propertyId,
          from,
          toExclusivePrimary,
          compareWindow?.from ?? null,
          toExclusiveCompare,
        ),
        this.queryLandings(
          propertyId,
          from,
          to,
          compareWindow?.from ?? null,
          compareWindow?.to ?? null,
        ),
        this.loadInventory(propertyId),
      ]);

    const cash = assembleCash(cashRows, inventory, compare);
    const { occupancy, occupancyByUnitType } = assembleOccupancy(
      inventory,
      stayClips,
      blockClips,
      periodNightsPrimary,
      periodNightsCompare,
      compare,
    );
    const sourceMix = assembleSourceMix(
      stayClips,
      landings,
      occupancy.occupiedNights,
      occupancy.compare?.occupiedNights ?? 0,
      compare,
    );

    const summary: StaffReportsSummary = {
      propertyId,
      from,
      to,
      cash,
      occupancy,
      occupancyByUnitType,
      sourceMix,
    };
    if (compareWindow) {
      summary.compare = compareWindow;
    }
    return summary;
  }

  private async loadInventory(propertyId: string): Promise<InventoryUnit[]> {
    const units = await this.prisma.unit.findMany({
      where: { propertyId, status: UnitStatus.ACTIVE },
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        unitTypeId: true,
        unitType: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return units.map((u) => ({
      id: u.id,
      name: u.name?.trim() ? u.name : u.code,
      sortOrder: u.sortOrder,
      unitTypeId: u.unitTypeId,
      unitTypeName: u.unitType.name,
      unitTypeSortOrder: u.unitType.sortOrder,
    }));
  }

  private async queryCashAgg(
    propertyId: string,
    spanStart: Date,
    spanEnd: Date,
    pStart: Date,
    pEnd: Date,
    cStart: Date | null,
    cEnd: Date | null,
  ): Promise<CashAggRow[]> {
    type Raw = {
      period: string;
      source: string;
      unitTypeId: string | null;
      method: string | null;
      inIdr: bigint | number;
      outIdr: bigint | number;
    };

    const rows =
      cStart && cEnd
        ? await this.prisma.$queryRaw<Raw[]>`
            SELECT
              CASE
                WHEN pm."createdAt" >= ${pStart} AND pm."createdAt" < ${pEnd}
                  THEN 'primary'
                WHEN pm."createdAt" >= ${cStart} AND pm."createdAt" < ${cEnd}
                  THEN 'compare'
              END AS period,
              r.source::text AS source,
              u."unitTypeId" AS "unitTypeId",
              pm.method::text AS method,
              COALESCE(SUM(pm."amountIdr") FILTER (WHERE pm.direction = 'IN'), 0) AS "inIdr",
              COALESCE(SUM(pm."amountIdr") FILTER (WHERE pm.direction = 'OUT'), 0) AS "outIdr"
            FROM "PaymentMovement" pm
            INNER JOIN "Reservation" r ON r.id = pm."reservationId"
            INNER JOIN "Unit" u ON u.id = r."unitId"
            WHERE r."propertyId" = ${propertyId}
              AND pm."createdAt" >= ${spanStart}
              AND pm."createdAt" < ${spanEnd}
              AND (
                (pm."createdAt" >= ${pStart} AND pm."createdAt" < ${pEnd})
                OR (pm."createdAt" >= ${cStart} AND pm."createdAt" < ${cEnd})
              )
            GROUP BY 1, 2, 3, 4
          `
        : await this.prisma.$queryRaw<Raw[]>`
            SELECT
              'primary'::text AS period,
              r.source::text AS source,
              u."unitTypeId" AS "unitTypeId",
              pm.method::text AS method,
              COALESCE(SUM(pm."amountIdr") FILTER (WHERE pm.direction = 'IN'), 0) AS "inIdr",
              COALESCE(SUM(pm."amountIdr") FILTER (WHERE pm.direction = 'OUT'), 0) AS "outIdr"
            FROM "PaymentMovement" pm
            INNER JOIN "Reservation" r ON r.id = pm."reservationId"
            INNER JOIN "Unit" u ON u.id = r."unitId"
            WHERE r."propertyId" = ${propertyId}
              AND pm."createdAt" >= ${pStart}
              AND pm."createdAt" < ${pEnd}
            GROUP BY 2, 3, 4
          `;

    return rows
      .filter((r) => r.period === 'primary' || r.period === 'compare')
      .map((r) => ({
        period: r.period as 'primary' | 'compare',
        source: r.source,
        unitTypeId: r.unitTypeId,
        method: r.method,
        inIdr: toInt(r.inIdr),
        outIdr: toInt(r.outIdr),
      }));
  }

  private async queryStayClips(
    propertyId: string,
    pFrom: string,
    pToExcl: string,
    cFrom: string | null,
    cToExcl: string | null,
  ): Promise<StayClipRow[]> {
    type Raw = {
      period: string;
      unitId: string;
      source: string;
      nights: number | bigint;
    };

    const statuses = [...REPORTS_OCCUPANCY_STATUSES];
    const pFromD = parseYmdDate(pFrom);
    const pToExclD = parseYmdDate(pToExcl);

    const rows =
      cFrom && cToExcl
        ? await this.prisma.$queryRaw<Raw[]>`
            SELECT
              b.period,
              r."unitId" AS "unitId",
              r.source::text AS source,
              SUM(
                GREATEST(
                  0,
                  (LEAST(r."checkOutDate", b.to_excl) - GREATEST(r."checkInDate", b.from_d))
                )
              )::int AS nights
            FROM "Reservation" r
            CROSS JOIN (
              VALUES
                ('primary'::text, ${pFromD}::date, ${pToExclD}::date),
                ('compare'::text, ${parseYmdDate(cFrom)}::date, ${parseYmdDate(cToExcl)}::date)
            ) AS b(period, from_d, to_excl)
            WHERE r."propertyId" = ${propertyId}
              AND r.status::text IN (${Prisma.join(statuses)})
              AND r."checkInDate" < b.to_excl
              AND r."checkOutDate" > b.from_d
            GROUP BY b.period, r."unitId", r.source
          `
        : await this.prisma.$queryRaw<Raw[]>`
            SELECT
              'primary'::text AS period,
              r."unitId" AS "unitId",
              r.source::text AS source,
              SUM(
                GREATEST(
                  0,
                  (LEAST(r."checkOutDate", ${pToExclD}::date) - GREATEST(r."checkInDate", ${pFromD}::date))
                )
              )::int AS nights
            FROM "Reservation" r
            WHERE r."propertyId" = ${propertyId}
              AND r.status::text IN (${Prisma.join(statuses)})
              AND r."checkInDate" < ${pToExclD}::date
              AND r."checkOutDate" > ${pFromD}::date
            GROUP BY r."unitId", r.source
          `;

    return rows.map((r) => ({
      period: r.period as 'primary' | 'compare',
      unitId: r.unitId,
      source: r.source,
      nights: toInt(r.nights),
    }));
  }

  private async queryBlockClips(
    propertyId: string,
    pFrom: string,
    pToExcl: string,
    cFrom: string | null,
    cToExcl: string | null,
  ): Promise<BlockClipRow[]> {
    type Raw = {
      period: string;
      unitId: string;
      nights: number | bigint;
    };

    const pFromD = parseYmdDate(pFrom);
    const pToExclD = parseYmdDate(pToExcl);

    const rows =
      cFrom && cToExcl
        ? await this.prisma.$queryRaw<Raw[]>`
            SELECT
              b.period,
              cb."unitId" AS "unitId",
              SUM(
                GREATEST(
                  0,
                  (LEAST(cb."endDate", b.to_excl) - GREATEST(cb."startDate", b.from_d))
                )
              )::int AS nights
            FROM "CalendarBlock" cb
            CROSS JOIN (
              VALUES
                ('primary'::text, ${pFromD}::date, ${pToExclD}::date),
                ('compare'::text, ${parseYmdDate(cFrom)}::date, ${parseYmdDate(cToExcl)}::date)
            ) AS b(period, from_d, to_excl)
            WHERE cb."propertyId" = ${propertyId}
              AND cb."startDate" < b.to_excl
              AND cb."endDate" > b.from_d
            GROUP BY b.period, cb."unitId"
          `
        : await this.prisma.$queryRaw<Raw[]>`
            SELECT
              'primary'::text AS period,
              cb."unitId" AS "unitId",
              SUM(
                GREATEST(
                  0,
                  (LEAST(cb."endDate", ${pToExclD}::date) - GREATEST(cb."startDate", ${pFromD}::date))
                )
              )::int AS nights
            FROM "CalendarBlock" cb
            WHERE cb."propertyId" = ${propertyId}
              AND cb."startDate" < ${pToExclD}::date
              AND cb."endDate" > ${pFromD}::date
            GROUP BY cb."unitId"
          `;

    return rows.map((r) => ({
      period: r.period as 'primary' | 'compare',
      unitId: r.unitId,
      nights: toInt(r.nights),
    }));
  }

  private async queryLandings(
    propertyId: string,
    pFrom: string,
    pTo: string,
    cFrom: string | null,
    cTo: string | null,
  ): Promise<LandingRow[]> {
    type Raw = {
      period: string;
      source: string;
      stays: number | bigint;
    };

    const pFromD = parseYmdDate(pFrom);
    const pToD = parseYmdDate(pTo);

    const rows =
      cFrom && cTo
        ? await this.prisma.$queryRaw<Raw[]>`
            SELECT
              b.period,
              r.source::text AS source,
              COUNT(*)::int AS stays
            FROM "Reservation" r
            CROSS JOIN (
              VALUES
                ('primary'::text, ${pFromD}::date, ${pToD}::date),
                ('compare'::text, ${parseYmdDate(cFrom)}::date, ${parseYmdDate(cTo)}::date)
            ) AS b(period, from_d, to_d)
            WHERE r."propertyId" = ${propertyId}
              AND r.status <> 'CANCELLED'
              AND r."checkInDate" >= b.from_d
              AND r."checkInDate" <= b.to_d
            GROUP BY b.period, r.source
          `
        : await this.prisma.$queryRaw<Raw[]>`
            SELECT
              'primary'::text AS period,
              r.source::text AS source,
              COUNT(*)::int AS stays
            FROM "Reservation" r
            WHERE r."propertyId" = ${propertyId}
              AND r.status <> 'CANCELLED'
              AND r."checkInDate" >= ${pFromD}::date
              AND r."checkInDate" <= ${pToD}::date
            GROUP BY r.source
          `;

    return rows.map((r) => ({
      period: r.period as 'primary' | 'compare',
      source: r.source,
      stays: toInt(r.stays),
    }));
  }
}
