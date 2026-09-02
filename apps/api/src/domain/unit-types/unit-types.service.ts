import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  buildPageInfo,
  deriveBedroomCount,
  EMPTY_AMENITIES,
  UTILITY_ADDON_MAX_PER_KIND,
  UtilityKind,
  type BedConfigRoom,
  type Paginated,
  type StaffUnitType,
  type StaffUnitTypeRack,
  type UtilityAddonKind,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { toStaffUnitType } from '../inventory/inventory-mapper.js';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateUnitTypeDto } from './dto/create-unit-type.dto.js';
import type { ListUnitTypesQueryDto } from './dto/list-unit-types.query.dto.js';
import type { UpdateUnitTypeDto } from './dto/update-unit-type.dto.js';
import type { UtilityAddonInputDto } from './dto/utility-addon-input.dto.js';

type UtilityAddonWriteRow = {
  utility: UtilityKind;
  name: string;
  kind: UtilityAddonKind;
  value: number;
  sortOrder: number;
};

const unitTypeStaffInclude = {
  _count: { select: { units: true } },
  utilityAddons: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

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
        include: unitTypeStaffInclude,
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
      include: unitTypeStaffInclude,
    });
    if (!row) {
      throw new NotFoundException('Unit type not found');
    }
    return toStaffUnitType(row, row._count.units);
  }

  async getRackById(id: string): Promise<StaffUnitTypeRack> {
    const row = await this.prisma.unitType.findUnique({
      where: { id },
      select: {
        id: true,
        defaultPriceIdr: true,
        monthlyPriceIdr: true,
        yearlyPriceIdr: true,
        electricityRateIdrPerKwh: true,
        waterRateIdrPerM3: true,
        maintenanceFeeIdrPerMonth: true,
        electricityMinKwh: true,
        adminFeeIdrPerMonth: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Unit type not found');
    }
    return {
      id: row.id,
      defaultPriceIdr: row.defaultPriceIdr,
      monthlyPriceIdr: row.monthlyPriceIdr,
      yearlyPriceIdr: row.yearlyPriceIdr,
      electricityRateIdrPerKwh: row.electricityRateIdrPerKwh,
      waterRateIdrPerM3: row.waterRateIdrPerM3,
      maintenanceFeeIdrPerMonth: row.maintenanceFeeIdrPerMonth,
      electricityMinKwh: Number(row.electricityMinKwh),
      adminFeeIdrPerMonth: row.adminFeeIdrPerMonth,
    };
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
    const addonRows =
      dto.utilityAddons !== undefined
        ? this.normalizeUtilityAddonWrites(dto.utilityAddons)
        : undefined;

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
          monthlyPriceIdr: dto.monthlyPriceIdr,
          yearlyPriceIdr: dto.yearlyPriceIdr,
          electricityRateIdrPerKwh: dto.electricityRateIdrPerKwh ?? 0,
          waterRateIdrPerM3: dto.waterRateIdrPerM3 ?? 0,
          maintenanceFeeIdrPerMonth: dto.maintenanceFeeIdrPerMonth ?? 0,
          electricityMinKwh: dto.electricityMinKwh ?? 0,
          adminFeeIdrPerMonth: dto.adminFeeIdrPerMonth ?? 0,
          ...(addonRows !== undefined
            ? { utilityAddons: { create: addonRows } }
            : {}),
          bedConfig: bedConfig,
          amenities: (dto.amenities ??
            EMPTY_AMENITIES) as unknown as Prisma.InputJsonValue,
          media: (dto.media ?? []) as unknown as Prisma.InputJsonValue,
          description: dto.description?.trim() || null,
          smokingAllowed: dto.smokingAllowed ?? false,
          sortOrder,
          isActive: dto.isActive ?? true,
        },
        include: {
          utilityAddons: {
            orderBy: [
              { sortOrder: 'asc' as const },
              { createdAt: 'asc' as const },
            ],
          },
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

    const scalarData: Prisma.UnitTypeUpdateInput = {
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
      ...(dto.monthlyPriceIdr !== undefined
        ? { monthlyPriceIdr: dto.monthlyPriceIdr }
        : {}),
      ...(dto.yearlyPriceIdr !== undefined
        ? { yearlyPriceIdr: dto.yearlyPriceIdr }
        : {}),
      ...(dto.electricityRateIdrPerKwh !== undefined
        ? { electricityRateIdrPerKwh: dto.electricityRateIdrPerKwh }
        : {}),
      ...(dto.waterRateIdrPerM3 !== undefined
        ? { waterRateIdrPerM3: dto.waterRateIdrPerM3 }
        : {}),
      ...(dto.maintenanceFeeIdrPerMonth !== undefined
        ? { maintenanceFeeIdrPerMonth: dto.maintenanceFeeIdrPerMonth }
        : {}),
      ...(dto.electricityMinKwh !== undefined
        ? { electricityMinKwh: dto.electricityMinKwh }
        : {}),
      ...(dto.adminFeeIdrPerMonth !== undefined
        ? { adminFeeIdrPerMonth: dto.adminFeeIdrPerMonth }
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
    };

    try {
      if (dto.utilityAddons === undefined) {
        const updated = await this.prisma.unitType.update({
          where: { id },
          data: scalarData,
          include: unitTypeStaffInclude,
        });
        return toStaffUnitType(updated, updated._count.units);
      }

      const addonRows = this.normalizeUtilityAddonWrites(dto.utilityAddons);
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.unitType.update({
          where: { id },
          data: scalarData,
        });
        await tx.unitTypeUtilityAddon.deleteMany({
          where: { unitTypeId: id },
        });
        if (addonRows.length > 0) {
          await tx.unitTypeUtilityAddon.createMany({
            data: addonRows.map((row) => ({ ...row, unitTypeId: id })),
          });
        }
        return tx.unitType.findUniqueOrThrow({
          where: { id },
          include: unitTypeStaffInclude,
        });
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

  /**
   * `sortOrder` is assigned independently per utility. Missing values get
   * 0,1,2… in array appearance order among that utility (ELECTRICITY 0..n
   * and WATER 0..n, not a single mixed sequence).
   */
  private normalizeUtilityAddonWrites(
    addons: UtilityAddonInputDto[],
  ): UtilityAddonWriteRow[] {
    this.assertUtilityAddonScheme(addons);

    const nextIndex: Record<UtilityKind, number> = {
      [UtilityKind.ELECTRICITY]: 0,
      [UtilityKind.WATER]: 0,
    };

    return addons.map((addon) => {
      const utility = addon.utility;
      let sortOrder: number;
      if (addon.sortOrder !== undefined) {
        sortOrder = addon.sortOrder;
        nextIndex[utility] = Math.max(nextIndex[utility], addon.sortOrder + 1);
      } else {
        sortOrder = nextIndex[utility];
        nextIndex[utility] += 1;
      }
      return {
        utility,
        name: addon.name.trim(),
        kind: addon.kind,
        value: addon.value,
        sortOrder,
      };
    });
  }

  private assertUtilityAddonScheme(addons: UtilityAddonInputDto[]): void {
    const counts: Record<string, number> = {
      [UtilityKind.ELECTRICITY]: 0,
      [UtilityKind.WATER]: 0,
    };
    for (const addon of addons) {
      const utility: string = addon.utility;
      if (!(utility in counts)) {
        throw new BadRequestException({
          message: 'Unknown utility on add-on',
          details: {
            field: 'utilityAddons',
            reason: ApiFieldReason.UTILITY_ADDON_LIMIT,
          },
        });
      }
      counts[utility] += 1;
    }
    if (
      counts[UtilityKind.ELECTRICITY] > UTILITY_ADDON_MAX_PER_KIND ||
      counts[UtilityKind.WATER] > UTILITY_ADDON_MAX_PER_KIND
    ) {
      throw new BadRequestException({
        message: `At most ${UTILITY_ADDON_MAX_PER_KIND} add-ons per utility`,
        details: {
          field: 'utilityAddons',
          reason: ApiFieldReason.UTILITY_ADDON_LIMIT,
        },
      });
    }
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
