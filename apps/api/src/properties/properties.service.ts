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
  type PublicProperty,
} from '@cabin/api-contract';
import { Prisma } from '../generated/prisma/index.js';
import { toPublicProperty } from '../common/inventory/inventory-mapper.js';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePropertyDto } from './dto/create-property.dto.js';
import type { ListPropertiesQueryDto } from './dto/list-properties.query.dto.js';
import type { UpdatePropertyDto } from './dto/update-property.dto.js';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListPropertiesQueryDto,
  ): Promise<Paginated<PublicProperty>> {
    const where = this.buildWhere(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          _count: { select: { unitTypes: true, units: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) =>
        toPublicProperty(row, {
          typeCount: row._count.unitTypes,
          unitCount: row._count.units,
        }),
      ),
      pageInfo: buildPageInfo(query.page, query.pageSize, total),
    };
  }

  async getById(id: string): Promise<PublicProperty> {
    const row = await this.prisma.property.findUnique({
      where: { id },
      include: {
        _count: { select: { unitTypes: true, units: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Property not found');
    }
    return toPublicProperty(row, {
      typeCount: row._count.unitTypes,
      unitCount: row._count.units,
    });
  }

  async create(dto: CreatePropertyDto): Promise<PublicProperty> {
    const code = dto.code.trim().toUpperCase();
    this.assertLatLngPair(dto.latitude, dto.longitude);

    try {
      const created = await this.prisma.property.create({
        data: {
          code,
          name: dto.name.trim(),
          timezone: dto.timezone.trim() || 'Asia/Jakarta',
          checkInFrom: dto.checkInFrom ?? null,
          checkInUntil: dto.checkInUntil ?? null,
          checkOutFrom: dto.checkOutFrom ?? null,
          checkOutUntil: dto.checkOutUntil ?? null,
          addressLine: dto.addressLine?.trim() || null,
          city: dto.city?.trim() || null,
          countryCode: dto.countryCode?.trim().toUpperCase() || null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          googlePlaceId: dto.googlePlaceId?.trim() || null,
          coverImage:
            dto.coverImage == null
              ? Prisma.JsonNull
              : (dto.coverImage as unknown as Prisma.InputJsonValue),
          isActive: dto.isActive ?? true,
        },
      });
      return toPublicProperty(created, { typeCount: 0, unitCount: 0 });
    } catch (error: unknown) {
      this.rethrowCodeConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<PublicProperty> {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Property not found');
    }

    const latitude =
      dto.latitude !== undefined
        ? dto.latitude
        : (existing.latitude?.toNumber() ?? null);
    const longitude =
      dto.longitude !== undefined
        ? dto.longitude
        : (existing.longitude?.toNumber() ?? null);
    this.assertLatLngPair(latitude, longitude);

    const code =
      dto.code !== undefined ? dto.code.trim().toUpperCase() : existing.code;

    try {
      const updated = await this.prisma.property.update({
        where: { id },
        data: {
          code,
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.timezone !== undefined
            ? { timezone: dto.timezone.trim() || existing.timezone }
            : {}),
          ...(dto.checkInFrom !== undefined
            ? { checkInFrom: dto.checkInFrom }
            : {}),
          ...(dto.checkInUntil !== undefined
            ? { checkInUntil: dto.checkInUntil }
            : {}),
          ...(dto.checkOutFrom !== undefined
            ? { checkOutFrom: dto.checkOutFrom }
            : {}),
          ...(dto.checkOutUntil !== undefined
            ? { checkOutUntil: dto.checkOutUntil }
            : {}),
          ...(dto.addressLine !== undefined
            ? { addressLine: dto.addressLine?.trim() || null }
            : {}),
          ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
          ...(dto.countryCode !== undefined
            ? {
                countryCode: dto.countryCode?.trim().toUpperCase() || null,
              }
            : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
          ...(dto.googlePlaceId !== undefined
            ? { googlePlaceId: dto.googlePlaceId?.trim() || null }
            : {}),
          ...(dto.coverImage !== undefined
            ? {
                coverImage:
                  dto.coverImage === null
                    ? Prisma.JsonNull
                    : (dto.coverImage as unknown as Prisma.InputJsonValue),
              }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          _count: { select: { unitTypes: true, units: true } },
        },
      });
      return toPublicProperty(updated, {
        typeCount: updated._count.unitTypes,
        unitCount: updated._count.units,
      });
    } catch (error: unknown) {
      this.rethrowCodeConflict(error);
      throw error;
    }
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Property not found');
    }

    const [typeCount, unitCount] = await this.prisma.$transaction([
      this.prisma.unitType.count({ where: { propertyId: id } }),
      this.prisma.unit.count({ where: { propertyId: id } }),
    ]);

    if (typeCount > 0 || unitCount > 0) {
      throw new ConflictException({
        message: `Cannot delete: ${typeCount} type(s) and ${unitCount} unit(s) still belong to this property`,
        details: {
          field: 'id',
          reason: ApiFieldReason.HAS_CHILDREN,
          typeCount,
          unitCount,
        },
      });
    }

    try {
      await this.prisma.property.delete({ where: { id } });
    } catch (error: unknown) {
      this.rethrowRestrictConflict(error, 'Property');
      throw error;
    }

    return { ok: true };
  }

  private buildWhere(query: ListPropertiesQueryDto): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private assertLatLngPair(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): void {
    const latMissing = latitude === null || latitude === undefined;
    const lngMissing = longitude === null || longitude === undefined;
    if (latMissing === lngMissing) {
      return;
    }

    const missingField = latMissing ? 'latitude' : 'longitude';
    throw new BadRequestException({
      message: 'Enter both latitude and longitude',
      details: {
        field: missingField,
        reason: ApiFieldReason.LAT_LNG_PAIR_REQUIRED,
      },
    });
  }

  private rethrowCodeConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        message: 'A property with this code already exists',
        details: { field: 'code', reason: ApiFieldReason.CODE_TAKEN },
      });
    }
  }

  private rethrowRestrictConflict(error: unknown, label: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2014')
    ) {
      throw new ConflictException({
        message: `Cannot delete ${label}: related records still exist`,
        details: { field: 'id', reason: ApiFieldReason.HAS_CHILDREN },
      });
    }
  }
}
