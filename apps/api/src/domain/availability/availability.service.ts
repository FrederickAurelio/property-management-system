import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  addCalendarYearsYmd,
  computeInventoryEndYmd,
  isUnitStatusBookable,
  OCCUPYING_RESERVATION_STATUSES,
  StayBillingPeriod,
  UNIT_OCCUPANCY_RANGE_MAX_YEARS,
  UnitAvailabilityBlockReason,
  type StaffUnitAvailability,
  type UnitAvailabilityBlockReason as BlockReason,
  type UnitMonthOccupancy,
} from '@cabin/api-contract';
import { toStaffUnit } from '../inventory/inventory-mapper.js';
import { findBusyUnitIds } from '../reservations/overlap.js';
import { parseYmd } from '../reservations/reservations-mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UnitMonthOccupancyQueryDto } from './dto/unit-month-occupancy.query.dto.js';
import type { UnitsAvailabilityQueryDto } from './dto/units-availability.query.dto.js';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Choose unit list: every unit in the property (+ optional type),
   * each tagged `available` / `blockReason` (not filtered away).
   * Dates optional — without a stay range, DATE_OVERLAP is not applied.
   */
  async listAvailableUnits(
    propertyId: string,
    query: UnitsAvailabilityQueryDto,
  ): Promise<StaffUnitAvailability[]> {
    const hasIn = Boolean(query.checkInDate);
    const hasOut = Boolean(query.checkOutDate);
    if (hasIn !== hasOut) {
      throw new BadRequestException({
        message: 'Provide both checkInDate and checkOutDate, or neither',
        details: {
          field: hasIn ? 'checkOutDate' : 'checkInDate',
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
    if (hasIn && hasOut) {
      this.assertDateRange(query.checkInDate!, query.checkOutDate!);
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, isActive: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const units = await this.prisma.unit.findMany({
      where: {
        propertyId,
        ...(query.unitTypeId ? { unitTypeId: query.unitTypeId } : {}),
      },
      include: {
        unitType: { select: { isActive: true } },
        icalFeeds: { orderBy: { source: 'asc' } },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    if (units.length === 0) {
      return [];
    }

    const busyEndDate =
      hasIn && hasOut
        ? computeInventoryEndYmd(
            query.billingPeriod ?? StayBillingPeriod.DAILY,
            query.checkOutDate!,
          )
        : undefined;

    const busy =
      hasIn && hasOut
        ? await findBusyUnitIds(this.prisma, {
            propertyId,
            checkInDate: query.checkInDate!,
            checkOutDate: query.checkOutDate!,
            ...(busyEndDate ? { busyEndDate } : {}),
            unitIds: units.map((u) => u.id),
            ...(query.excludeReservationId
              ? { excludeReservationId: query.excludeReservationId }
              : {}),
            ...(query.excludeBlockId
              ? { excludeBlockId: query.excludeBlockId }
              : {}),
          })
        : new Set<string>();

    return units.map((unit) => {
      const blockReason = resolveBlockReason({
        propertyActive: property.isActive,
        unitTypeActive: unit.unitType.isActive,
        unitStatus: unit.status,
        dateOverlap: busy.has(unit.id),
      });
      return {
        ...toStaffUnit(unit),
        available: blockReason === null,
        blockReason,
      };
    });
  }

  /**
   * Occupying stays/blocks for date-picker blocking.
   * `yearMonth` → one month (+ spill clip).
   * `from`+`to` → half-open window in one query (preferred for M/Y pickers).
   */
  async getUnitMonthOccupancy(
    unitId: string,
    query: UnitMonthOccupancyQueryDto,
  ): Promise<UnitMonthOccupancy> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const window = resolveOccupancyWindow(query);
    const rangeStart = parseYmd(window.from);
    const rangeEnd = parseYmd(window.to);
    const clipYmd = window.clipYmd;

    const excludeStay = query.excludeReservationId
      ? { id: { not: query.excludeReservationId } }
      : {};

    const [stayRows, blockRows, stayHorizon, blockHorizon] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          unitId,
          status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
          icalOverlapHold: false,
          checkInDate: { lt: rangeEnd },
          inventoryEndDate: { gt: rangeStart },
          ...excludeStay,
        },
        select: {
          id: true,
          checkInDate: true,
          checkOutDate: true,
          inventoryEndDate: true,
        },
        orderBy: { checkInDate: 'asc' },
      }),
      this.prisma.calendarBlock.findMany({
        where: {
          unitId,
          startDate: { lt: rangeEnd },
          endDate: { gt: rangeStart },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: 'asc' },
      }),
      // Unit-wide MAX inventory end — cheap open-hold horizon (not window-clipped).
      this.prisma.reservation.aggregate({
        where: {
          unitId,
          status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
          icalOverlapHold: false,
          ...excludeStay,
        },
        _max: { inventoryEndDate: true },
      }),
      this.prisma.calendarBlock.aggregate({
        where: { unitId },
        _max: { endDate: true },
      }),
    ]);

    const blocks = [
      ...stayRows.map((row) => ({
        reservationId: row.id,
        checkInDate: toYmd(row.checkInDate),
        checkOutDate: clipExclusiveEnd(toYmd(row.inventoryEndDate), clipYmd),
        contractCheckOutDate: toYmd(row.checkOutDate),
      })),
      ...blockRows.map((row) => ({
        reservationId: row.id,
        checkInDate: toYmd(row.startDate),
        checkOutDate: clipExclusiveEnd(toYmd(row.endDate), clipYmd),
      })),
    ].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));

    const openHoldBlockedBefore = maxExclusiveYmd(
      stayHorizon._max.inventoryEndDate
        ? toYmd(stayHorizon._max.inventoryEndDate)
        : null,
      blockHorizon._max.endDate ? toYmd(blockHorizon._max.endDate) : null,
    );

    return {
      unitId,
      yearMonth: window.yearMonth,
      from: window.from,
      to: window.to,
      blocks,
      openHoldBlockedBefore,
    };
  }

  private assertDateRange(checkInDate: string, checkOutDate: string): void {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate) ||
      checkOutDate <= checkInDate
    ) {
      throw new BadRequestException({
        message: 'Invalid stay date range',
        details: {
          field: 'checkOutDate',
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
  }
}

function resolveBlockReason(input: {
  propertyActive: boolean;
  unitTypeActive: boolean;
  unitStatus: Parameters<typeof isUnitStatusBookable>[0];
  dateOverlap: boolean;
}): BlockReason | null {
  if (!input.propertyActive) {
    return UnitAvailabilityBlockReason.PROPERTY_INACTIVE;
  }
  if (!input.unitTypeActive) {
    return UnitAvailabilityBlockReason.UNIT_TYPE_INACTIVE;
  }
  if (!isUnitStatusBookable(input.unitStatus)) {
    return UnitAvailabilityBlockReason.UNIT_NOT_BOOKABLE;
  }
  if (input.dateOverlap) {
    return UnitAvailabilityBlockReason.DATE_OVERLAP;
  }
  return null;
}

function resolveOccupancyWindow(query: UnitMonthOccupancyQueryDto): {
  yearMonth: string;
  from: string;
  to: string;
  clipYmd: string;
} {
  const hasFrom = Boolean(query.from);
  const hasTo = Boolean(query.to);
  if (hasFrom !== hasTo) {
    throw new BadRequestException({
      message: 'Provide both from and to, or yearMonth alone',
      details: {
        field: hasFrom ? 'to' : 'from',
        reason: ApiFieldReason.DATE_RANGE_INVALID,
      },
    });
  }

  if (query.from && query.to) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(query.from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(query.to) ||
      query.to <= query.from
    ) {
      throw new BadRequestException({
        message: 'Invalid occupancy range',
        details: {
          field: 'to',
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
    const maxTo = addCalendarYearsYmd(
      query.from,
      UNIT_OCCUPANCY_RANGE_MAX_YEARS,
    );
    if (query.to > maxTo) {
      throw new BadRequestException({
        message: `Occupancy range cannot exceed ${UNIT_OCCUPANCY_RANGE_MAX_YEARS} years`,
        details: {
          field: 'to',
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
    return {
      yearMonth: query.from.slice(0, 7),
      from: query.from,
      to: query.to,
      clipYmd: query.to,
    };
  }

  if (!query.yearMonth) {
    throw new BadRequestException({
      message: 'Provide yearMonth, or both from and to',
      details: {
        field: 'yearMonth',
        reason: ApiFieldReason.DATE_RANGE_INVALID,
      },
    });
  }

  const { monthStart, monthEnd } = monthBounds(query.yearMonth);
  // Spare one month past `yearMonth` so grids that show spill days of the
  // next month stay blocked when expanding FAR / long intervals.
  const spillClipYmd = toYmd(
    new Date(
      Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() + 1, 1),
    ),
  );
  return {
    yearMonth: query.yearMonth,
    from: toYmd(monthStart),
    to: toYmd(monthEnd),
    clipYmd: spillClipYmd,
  };
}

function clipExclusiveEnd(endYmd: string, clipYmd: string): string {
  return endYmd < clipYmd ? endYmd : clipYmd;
}

/** Later of two exclusive-end YMD strings (nulls ignored). */
function maxExclusiveYmd(a: string | null, b: string | null): string | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return a >= b ? a : b;
}

function monthBounds(yearMonth: string): { monthStart: Date; monthEnd: Date } {
  const [yRaw, mRaw] = yearMonth.split('-');
  const year = Number(yRaw);
  const month = Number(mRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new BadRequestException({
      message: 'Invalid yearMonth',
      details: {
        field: 'yearMonth',
        reason: ApiFieldReason.DATE_RANGE_INVALID,
      },
    });
  }
  const monthStart = parseYmd(`${year}-${String(month).padStart(2, '0')}-01`);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const monthEnd = parseYmd(
    `${endYear}-${String(endMonth).padStart(2, '0')}-01`,
  );
  return { monthStart, monthEnd };
}

function toYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
