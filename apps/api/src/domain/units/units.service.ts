import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  buildPageInfo,
  type Paginated,
  type StaffUnit,
  type StaffUnitIcalFeedInput,
  UNIT_ICAL_FEED_SOURCES,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import {
  newIcalExportToken,
  toStaffUnit,
} from '../inventory/inventory-mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateUnitDto } from './dto/create-unit.dto.js';
import type { ListUnitsQueryDto } from './dto/list-units.query.dto.js';
import type { UpdateUnitDto } from './dto/update-unit.dto.js';

const unitWithFeeds = {
  icalFeeds: { orderBy: { source: 'asc' as const } },
} satisfies Prisma.UnitInclude;

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProperty(
    propertyId: string,
    query: ListUnitsQueryDto,
  ): Promise<Paginated<StaffUnit>> {
    await this.assertPropertyExists(propertyId);

    const where: Prisma.UnitWhereInput = { propertyId };
    if (query.unitTypeId) {
      where.unitTypeId = query.unitTypeId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { floor: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.unit.count({ where }),
      this.prisma.unit.findMany({
        where,
        include: unitWithFeeds,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(toStaffUnit),
      pageInfo: buildPageInfo(query.page, query.pageSize, total),
    };
  }

  async getById(id: string): Promise<StaffUnit> {
    const row = await this.prisma.unit.findUnique({
      where: { id },
      include: unitWithFeeds,
    });
    if (!row) {
      throw new NotFoundException('Unit not found');
    }
    return toStaffUnit(row);
  }

  async create(propertyId: string, dto: CreateUnitDto): Promise<StaffUnit> {
    await this.assertPropertyExists(propertyId);

    const unitType = await this.prisma.unitType.findUnique({
      where: { id: dto.unitTypeId },
    });
    if (!unitType || unitType.propertyId !== propertyId) {
      throw new BadRequestException({
        message: 'Unit type not found on this property',
        details: {
          field: 'unitTypeId',
          reason: ApiFieldReason.UNIT_TYPE_INVALID,
        },
      });
    }

    const code = dto.code.trim().toUpperCase();
    const sortOrder = await this.nextSortOrder(propertyId, dto.unitTypeId);
    const feedCreates = this.feedCreatesFromInput(dto.icalFeeds);

    try {
      const created = await this.prisma.unit.create({
        data: {
          propertyId,
          unitTypeId: dto.unitTypeId,
          code,
          name: dto.name?.trim() || null,
          floor: dto.floor?.trim() || null,
          status: dto.status,
          notes: dto.notes?.trim() || null,
          sortOrder,
          icalExportToken: newIcalExportToken(),
          ...(feedCreates.length > 0
            ? { icalFeeds: { create: feedCreates } }
            : {}),
        },
        include: unitWithFeeds,
      });
      return toStaffUnit(created);
    } catch (error: unknown) {
      this.rethrowCodeConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateUnitDto): Promise<StaffUnit> {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Unit not found');
    }

    const code =
      dto.code !== undefined ? dto.code.trim().toUpperCase() : existing.code;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.icalFeeds !== undefined) {
          await this.syncFeeds(tx, id, dto.icalFeeds);
        }

        return tx.unit.update({
          where: { id },
          data: {
            code,
            ...(dto.name !== undefined
              ? { name: dto.name?.trim() || null }
              : {}),
            ...(dto.floor !== undefined
              ? { floor: dto.floor?.trim() || null }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.notes !== undefined
              ? { notes: dto.notes?.trim() || null }
              : {}),
          },
          include: unitWithFeeds,
        });
      });
      return toStaffUnit(updated);
    } catch (error: unknown) {
      this.rethrowCodeConflict(error);
      throw error;
    }
  }

  async rotateIcalToken(id: string): Promise<StaffUnit> {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Unit not found');
    }

    const updated = await this.prisma.unit.update({
      where: { id },
      data: { icalExportToken: newIcalExportToken() },
      include: unitWithFeeds,
    });
    return toStaffUnit(updated);
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Unit not found');
    }

    const reservationCount = await this.prisma.reservation.count({
      where: { unitId: id },
    });
    if (reservationCount > 0) {
      throw new ConflictException({
        message: 'Cannot delete unit: reservations still exist',
        details: {
          field: 'id',
          reason: ApiFieldReason.HAS_CHILDREN,
          reservationCount,
        },
      });
    }

    try {
      await this.prisma.unit.delete({ where: { id } });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new ConflictException({
          message: 'Cannot delete unit: related records still exist',
          details: { field: 'id', reason: ApiFieldReason.HAS_CHILDREN },
        });
      }
      throw error;
    }

    return { ok: true };
  }

  private feedCreatesFromInput(
    feeds: StaffUnitIcalFeedInput[] | undefined,
  ): { source: (typeof UNIT_ICAL_FEED_SOURCES)[number]; importUrl: string }[] {
    if (!feeds?.length) {
      return [];
    }
    const seen = new Set<string>();
    const out: {
      source: (typeof UNIT_ICAL_FEED_SOURCES)[number];
      importUrl: string;
    }[] = [];
    for (const feed of feeds) {
      if (seen.has(feed.source)) {
        throw new BadRequestException(
          `Duplicate iCal feed source ${feed.source}`,
        );
      }
      seen.add(feed.source);
      const url = feed.importUrl.trim();
      if (!url) {
        continue;
      }
      if (
        !(UNIT_ICAL_FEED_SOURCES as readonly string[]).includes(feed.source)
      ) {
        throw new BadRequestException(
          `Invalid iCal feed source ${feed.source}`,
        );
      }
      out.push({
        source: feed.source,
        importUrl: url,
      });
    }
    return out;
  }

  private async syncFeeds(
    tx: Prisma.TransactionClient,
    unitId: string,
    feeds: StaffUnitIcalFeedInput[],
  ): Promise<void> {
    const creates = this.feedCreatesFromInput(feeds);
    const keepSources = new Set(creates.map((c) => c.source));

    await tx.unitIcalFeed.deleteMany({
      where: {
        unitId,
        source: { notIn: [...keepSources] },
      },
    });

    for (const feed of creates) {
      await tx.unitIcalFeed.upsert({
        where: {
          unitId_source: { unitId, source: feed.source },
        },
        create: {
          unitId,
          source: feed.source,
          importUrl: feed.importUrl,
          isActive: true,
        },
        update: {
          importUrl: feed.importUrl,
          isActive: true,
          lastError: null,
        },
      });
    }

    // Explicit empty URL for a source in input → already excluded from creates;
    // also delete sources present in input with empty URL.
    for (const feed of feeds) {
      if (feed.importUrl.trim()) {
        continue;
      }
      await tx.unitIcalFeed.deleteMany({
        where: { unitId, source: feed.source },
      });
    }
  }

  private async assertPropertyExists(propertyId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
  }

  private async nextSortOrder(
    propertyId: string,
    unitTypeId: string,
  ): Promise<number> {
    const agg = await this.prisma.unit.aggregate({
      where: { propertyId, unitTypeId },
      _max: { sortOrder: true },
    });
    return (agg._max.sortOrder ?? 0) + 1;
  }

  private rethrowCodeConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        message: 'A unit with this code already exists on this property',
        details: { field: 'code', reason: ApiFieldReason.CODE_TAKEN },
      });
    }
  }
}
