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
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { toStaffUnit } from '../inventory/inventory-mapper.js';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateUnitDto } from './dto/create-unit.dto.js';
import type { ListUnitsQueryDto } from './dto/list-units.query.dto.js';
import type { UpdateUnitDto } from './dto/update-unit.dto.js';

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
    const row = await this.prisma.unit.findUnique({ where: { id } });
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
        },
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
      const updated = await this.prisma.unit.update({
        where: { id },
        data: {
          code,
          ...(dto.name !== undefined ? { name: dto.name?.trim() || null } : {}),
          ...(dto.floor !== undefined
            ? { floor: dto.floor?.trim() || null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
        },
      });
      return toStaffUnit(updated);
    } catch (error: unknown) {
      this.rethrowCodeConflict(error);
      throw error;
    }
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
