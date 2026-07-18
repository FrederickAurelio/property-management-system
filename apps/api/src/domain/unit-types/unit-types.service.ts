import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  buildPageInfo,
  deriveBedroomCount,
  EMPTY_AMENITIES,
  type BedConfigRoom,
  type Paginated,
  type StaffUnitType,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { toStaffUnitType } from '../inventory/inventory-mapper.js';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateUnitTypeDto } from './dto/create-unit-type.dto.js';
import type { ListUnitTypesQueryDto } from './dto/list-unit-types.query.dto.js';
import type { UpdateUnitTypeDto } from './dto/update-unit-type.dto.js';

@Injectable()
export class UnitTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProperty(
    propertyId: string,
    query: ListUnitTypesQueryDto,
  ): Promise<Paginated<StaffUnitType>> {
    await this.assertPropertyExists(propertyId);

    const where: Prisma.UnitTypeWhereInput = { propertyId };
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.unitType.count({ where }),
      this.prisma.unitType.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { units: true } } },
      }),
    ]);

    return {
      items: rows.map((row) => toStaffUnitType(row, row._count.units)),
      pageInfo: buildPageInfo(query.page, query.pageSize, total),
    };
  }

  async getById(id: string): Promise<StaffUnitType> {
    const row = await this.prisma.unitType.findUnique({
      where: { id },
      include: { _count: { select: { units: true } } },
    });
    if (!row) {
      throw new NotFoundException('Unit type not found');
    }
    return toStaffUnitType(row, row._count.units);
  }

  async create(
    propertyId: string,
    dto: CreateUnitTypeDto,
  ): Promise<StaffUnitType> {
    await this.assertPropertyExists(propertyId);

    const code = dto.code.trim().toUpperCase();
    const bedConfig = (dto.bedConfig ?? []) as BedConfigRoom[];
    const bedroomCount = deriveBedroomCount(dto.layout, bedConfig);
    const sortOrder = await this.nextSortOrder(propertyId);

    try {
      const created = await this.prisma.unitType.create({
        data: {
          propertyId,
          code,
          name: dto.name.trim(),
          layout: dto.layout,
          sizeSqm: dto.sizeSqm ?? null,
          bedroomCount,
          bathroomCount: dto.bathroomCount,
          maxGuests: dto.maxGuests,
          defaultPriceIdr: dto.defaultPriceIdr,
          bedConfig: bedConfig,
          amenities: (dto.amenities ??
            EMPTY_AMENITIES) as unknown as Prisma.InputJsonValue,
          media: (dto.media ?? []) as unknown as Prisma.InputJsonValue,
          description: dto.description?.trim() || null,
          smokingAllowed: dto.smokingAllowed ?? false,
          sortOrder,
          isActive: dto.isActive ?? true,
        },
      });
      return toStaffUnitType(created, 0);
    } catch (error: unknown) {
      this.rethrowCodeConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateUnitTypeDto): Promise<StaffUnitType> {
    const existing = await this.prisma.unitType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Unit type not found');
    }

    const layout = dto.layout ?? existing.layout;
    const bedConfig =
      dto.bedConfig !== undefined
        ? (dto.bedConfig as BedConfigRoom[])
        : (existing.bedConfig as unknown as BedConfigRoom[]);
    const bedroomCount = deriveBedroomCount(layout, bedConfig);
    const code =
      dto.code !== undefined ? dto.code.trim().toUpperCase() : existing.code;

    try {
      const updated = await this.prisma.unitType.update({
        where: { id },
        data: {
          code,
          bedroomCount,
          layout,
          bedConfig: bedConfig,
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.sizeSqm !== undefined ? { sizeSqm: dto.sizeSqm } : {}),
          ...(dto.bathroomCount !== undefined
            ? { bathroomCount: dto.bathroomCount }
            : {}),
          ...(dto.maxGuests !== undefined ? { maxGuests: dto.maxGuests } : {}),
          ...(dto.defaultPriceIdr !== undefined
            ? { defaultPriceIdr: dto.defaultPriceIdr }
            : {}),
          ...(dto.amenities !== undefined
            ? {
                amenities: dto.amenities as unknown as Prisma.InputJsonValue,
              }
            : {}),
          ...(dto.media !== undefined
            ? { media: dto.media as unknown as Prisma.InputJsonValue }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.smokingAllowed !== undefined
            ? { smokingAllowed: dto.smokingAllowed }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: { _count: { select: { units: true } } },
      });
      return toStaffUnitType(updated, updated._count.units);
    } catch (error: unknown) {
      this.rethrowCodeConflict(error);
      throw error;
    }
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.unitType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Unit type not found');
    }

    const unitCount = await this.prisma.unit.count({
      where: { unitTypeId: id },
    });
    if (unitCount > 0) {
      throw new ConflictException({
        message: `Cannot delete: ${unitCount} unit(s) still use this type`,
        details: {
          field: 'id',
          reason: ApiFieldReason.HAS_CHILDREN,
          unitCount,
        },
      });
    }

    try {
      await this.prisma.unitType.delete({ where: { id } });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new ConflictException({
          message: 'Cannot delete unit type: related units still exist',
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

  private async nextSortOrder(propertyId: string): Promise<number> {
    const agg = await this.prisma.unitType.aggregate({
      where: { propertyId },
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
        message: 'A unit type with this code already exists on this property',
        details: { field: 'code', reason: ApiFieldReason.CODE_TAKEN },
      });
    }
  }
}
