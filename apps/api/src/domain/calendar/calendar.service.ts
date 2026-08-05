import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  OCCUPYING_RESERVATION_STATUSES,
  type StaffAdmin,
  type StaffCalendarBlock,
  type StaffPropertyCalendar,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  findOccupyingOverlap,
  type BlockOverlapHit,
  type OverlapHit,
  type StayOverlapHit,
} from '../reservations/overlap.js';
import { parseYmd } from '../reservations/reservations-mapper.js';
import {
  calendarYmd,
  toStaffCalendarBlock,
  toStaffCalendarStay,
  toStaffCalendarUnit,
} from './calendar-mapper.js';
import type { CreateCalendarBlockDto } from './dto/create-calendar-block.dto.js';
import type { PropertyCalendarQueryDto } from './dto/property-calendar.query.dto.js';
import type { UpdateCalendarBlockDto } from './dto/update-calendar-block.dto.js';

type Actor = Pick<StaffAdmin, 'id'>;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getPropertyCalendar(
    propertyId: string,
    query: PropertyCalendarQueryDto,
  ): Promise<StaffPropertyCalendar> {
    this.assertDateRange(query.from, query.to, 'to');

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const from = parseYmd(query.from);
    const to = parseYmd(query.to);

    const [units, stays, blocks] = await Promise.all([
      this.prisma.unit.findMany({
        where: { propertyId },
        include: {
          unitType: { select: { id: true, name: true, sortOrder: true } },
        },
        orderBy: [
          { unitType: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { code: 'asc' },
        ],
      }),
      this.prisma.reservation.findMany({
        where: {
          propertyId,
          status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
          icalOverlapHold: false,
          checkInDate: { lt: to },
          inventoryEndDate: { gt: from },
        },
        select: {
          id: true,
          unitId: true,
          source: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          inventoryEndDate: true,
          guestName: true,
          totalAmountIdr: true,
          paidAmountIdr: true,
          paymentStatus: true,
          collectedVia: true,
          icalSyncWarning: true,
          property: { select: { timezone: true } },
        },
        orderBy: { checkInDate: 'asc' },
      }),
      this.prisma.calendarBlock.findMany({
        where: {
          propertyId,
          startDate: { lt: to },
          endDate: { gt: from },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    return {
      propertyId,
      from: query.from,
      to: query.to,
      units: units.map(toStaffCalendarUnit),
      stays: stays.map(toStaffCalendarStay),
      blocks: blocks.map(toStaffCalendarBlock),
    };
  }

  async createBlock(
    dto: CreateCalendarBlockDto,
    actor: Actor,
  ): Promise<StaffCalendarBlock> {
    this.assertDateRange(dto.startDate, dto.endDate, 'endDate');

    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, propertyId: dto.propertyId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found on this property');
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const overlap = await findOccupyingOverlap(tx, {
          unitId: dto.unitId,
          checkInDate: dto.startDate,
          checkOutDate: dto.endDate,
        });
        if (overlap) {
          this.throwOverlap(overlap, 'startDate');
        }

        return tx.calendarBlock.create({
          data: {
            propertyId: dto.propertyId,
            unitId: dto.unitId,
            kind: dto.kind,
            startDate: parseYmd(dto.startDate),
            endDate: parseYmd(dto.endDate),
            note: dto.note?.trim() ? dto.note.trim() : null,
            createdByAdminId: actor.id,
          },
        });
      });

      return toStaffCalendarBlock(created);
    } catch (error: unknown) {
      this.rethrowExclusionConflict(error, 'startDate');
      throw error;
    }
  }

  async updateBlock(
    id: string,
    dto: UpdateCalendarBlockDto,
  ): Promise<StaffCalendarBlock> {
    const existing = await this.prisma.calendarBlock.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Calendar block not found');
    }

    const unitId = dto.unitId ?? existing.unitId;
    const startDate = dto.startDate ?? calendarYmd(existing.startDate);
    const endDate = dto.endDate ?? calendarYmd(existing.endDate);
    this.assertDateRange(startDate, endDate, 'endDate');

    if (dto.unitId && dto.unitId !== existing.unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: { id: dto.unitId, propertyId: existing.propertyId },
        select: { id: true },
      });
      if (!unit) {
        throw new NotFoundException('Unit not found on this property');
      }
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const overlap = await findOccupyingOverlap(tx, {
          unitId,
          checkInDate: startDate,
          checkOutDate: endDate,
          excludeBlockId: id,
        });
        if (overlap) {
          this.throwOverlap(overlap, 'startDate');
        }

        return tx.calendarBlock.update({
          where: { id },
          data: {
            ...(dto.unitId !== undefined ? { unitId: dto.unitId } : {}),
            ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
            ...(dto.startDate !== undefined
              ? { startDate: parseYmd(dto.startDate) }
              : {}),
            ...(dto.endDate !== undefined
              ? { endDate: parseYmd(dto.endDate) }
              : {}),
            ...(dto.note !== undefined
              ? { note: dto.note?.trim() ? dto.note.trim() : null }
              : {}),
          },
        });
      });

      return toStaffCalendarBlock(updated);
    } catch (error: unknown) {
      this.rethrowExclusionConflict(error, 'startDate');
      throw error;
    }
  }

  async deleteBlock(id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.calendarBlock.delete({ where: { id } });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Calendar block not found');
      }
      throw error;
    }
    return { ok: true };
  }

  private assertDateRange(
    startDate: string,
    endDate: string,
    endField: 'to' | 'endDate',
  ): void {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
      endDate <= startDate
    ) {
      throw new BadRequestException({
        message: 'Invalid date range',
        details: {
          field: endField,
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
  }

  private throwOverlap(
    hit: OverlapHit,
    field: 'startDate' | 'checkInDate',
  ): never {
    if (hit.type === 'stay') {
      this.throwStayOverlap(hit, field);
    }
    this.throwBlockOverlap(hit, field);
  }

  private throwStayOverlap(
    hit: StayOverlapHit,
    field: 'startDate' | 'checkInDate',
  ): never {
    throw new ConflictException({
      message: `These dates overlap a stay by ${hit.guestName}`,
      details: {
        field,
        reason: ApiFieldReason.OVERLAP_CONFLICT,
        conflictingReservation: {
          id: hit.id,
          guestName: hit.guestName,
          source: hit.source,
          checkInDate: calendarYmd(hit.checkInDate),
          checkOutDate: calendarYmd(hit.checkOutDate),
          status: hit.status,
        },
      },
    });
  }

  private throwBlockOverlap(
    hit: BlockOverlapHit,
    field: 'startDate' | 'checkInDate',
  ): never {
    throw new ConflictException({
      message: `These dates overlap a ${hit.kind.toLowerCase()} block (${calendarYmd(hit.startDate)} → ${calendarYmd(hit.endDate)})`,
      details: {
        field,
        reason: ApiFieldReason.OVERLAP_CONFLICT,
        conflictingBlock: {
          id: hit.id,
          kind: hit.kind,
          startDate: calendarYmd(hit.startDate),
          endDate: calendarYmd(hit.endDate),
        },
      },
    });
  }

  private rethrowExclusionConflict(
    error: unknown,
    field: 'startDate' | 'checkInDate',
  ): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2004' ||
        error.message.includes('CalendarBlock_unit_excl') ||
        error.message.includes('Reservation_unit_occupying_excl'))
    ) {
      throw new ConflictException({
        message: 'These dates overlap an existing stay or block on this unit',
        details: {
          field,
          reason: ApiFieldReason.OVERLAP_CONFLICT,
        },
      });
    }
    if (
      error instanceof Error &&
      /CalendarBlock_unit_excl|Reservation_unit_occupying_excl|exclusion|23P01/i.test(
        error.message,
      )
    ) {
      throw new ConflictException({
        message: 'These dates overlap an existing stay or block on this unit',
        details: {
          field,
          reason: ApiFieldReason.OVERLAP_CONFLICT,
        },
      });
    }
  }
}
