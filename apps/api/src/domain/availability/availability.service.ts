import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  isUnitStatusBookable,
  OCCUPYING_RESERVATION_STATUSES,
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
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    if (units.length === 0) {
      return [];
    }

    const busy =
      hasIn && hasOut
        ? await findBusyUnitIds(this.prisma, {
            propertyId,
            checkInDate: query.checkInDate!,
            checkOutDate: query.checkOutDate!,
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
   * Occupying stays overlapping one calendar month — for date-picker blocking.
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

    const { monthStart, monthEnd } = monthBounds(query.yearMonth);

    const [stayRows, blockRows] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          unitId,
          status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
          checkInDate: { lt: monthEnd },
          checkOutDate: { gt: monthStart },
          ...(query.excludeReservationId
            ? { id: { not: query.excludeReservationId } }
            : {}),
        },
        select: {
          id: true,
          checkInDate: true,
          checkOutDate: true,
        },
        orderBy: { checkInDate: 'asc' },
      }),
      this.prisma.calendarBlock.findMany({
        where: {
          unitId,
          startDate: { lt: monthEnd },
          endDate: { gt: monthStart },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    const blocks = [
      ...stayRows.map((row) => ({
        reservationId: row.id,
        checkInDate: toYmd(row.checkInDate),
        checkOutDate: toYmd(row.checkOutDate),
      })),
      ...blockRows.map((row) => ({
        reservationId: row.id,
        checkInDate: toYmd(row.startDate),
        checkOutDate: toYmd(row.endDate),
      })),
    ].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));

    return {
      unitId,
      yearMonth: query.yearMonth,
      blocks,
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
