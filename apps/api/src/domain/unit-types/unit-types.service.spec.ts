import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  ApiFieldReason,
  UnitLayout,
  UtilityAddonKind,
  UtilityKind,
} from '@cabin/api-contract';
import { UnitTypesService } from './unit-types.service';
import { PrismaService } from '../../prisma/prisma.service';

const studioCreateDto = {
  code: 'DLX',
  name: 'Studio',
  layout: UnitLayout.STUDIO,
  bathroomCount: 1,
  maxGuests: 2,
  defaultPriceIdr: 400_000,
  monthlyPriceIdr: 10_400_000,
  yearlyPriceIdr: 120_000_000,
  bedConfig: [
    { room: 'Studio', beds: [{ type: 'LARGE_DOUBLE' as const, count: 1 }] },
  ],
};

describe('UnitTypesService', () => {
  let service: UnitTypesService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unitType: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
    };
    unitTypeUtilityAddon: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    unit: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  const typeRow = {
    id: 'type_1',
    propertyId: 'prop_1',
    code: 'DLX_STUDIO',
    name: 'Deluxe Studio',
    layout: UnitLayout.STUDIO,
    sizeSqm: null,
    bedroomCount: 0,
    bathroomCount: 1,
    maxGuests: 2,
    defaultPriceIdr: 400_000,
    monthlyPriceIdr: 10_400_000,
    yearlyPriceIdr: 120_000_000,
    electricityRateIdrPerKwh: 0,
    waterRateIdrPerM3: 0,
    maintenanceFeeIdrPerMonth: 0,
    electricityMinKwh: 0,
    adminFeeIdrPerMonth: 0,
    utilityAddons: [],
    bedConfig: [],
    amenities: {},
    media: [],
    description: null,
    smokingAllowed: false,
    sortOrder: 1,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      property: { findUnique: jest.fn() },
      unitType: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      unitTypeUtilityAddon: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      unit: { count: jest.fn() },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitTypesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(UnitTypesService);
  });

  describe('create', () => {
    it('derives bedroomCount 0 for STUDIO', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      prisma.unitType.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      prisma.unitType.create.mockImplementation(
        (args: { data: { bedroomCount: number } }) =>
          Promise.resolve({
            ...typeRow,
            ...args.data,
          }),
      );

      const created = await service.create('prop_1', studioCreateDto);

      const createCalls = prisma.unitType.create.mock.calls as Array<
        [{ data: { bedroomCount: number } }]
      >;
      expect(createCalls[0]?.[0].data.bedroomCount).toBe(0);
      expect(created.bedroomCount).toBe(0);
    });

    it('persists min kWh, admin fee, and nested add-ons', async () => {
      type AddonCreateRow = {
        utility: string;
        name: string;
        kind: string;
        value: number;
        sortOrder: number;
      };
      type CreateWithAddonsArg = {
        data: {
          electricityMinKwh: number;
          adminFeeIdrPerMonth: number;
          utilityAddons?: { create: AddonCreateRow[] };
        };
      };

      prisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      prisma.unitType.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      prisma.unitType.create.mockImplementation((args: CreateWithAddonsArg) =>
        Promise.resolve({
          ...typeRow,
          electricityMinKwh: args.data.electricityMinKwh,
          adminFeeIdrPerMonth: args.data.adminFeeIdrPerMonth,
          utilityAddons: args.data.utilityAddons?.create ?? [],
        }),
      );

      const created = await service.create('prop_1', {
        ...studioCreateDto,
        electricityMinKwh: 52,
        adminFeeIdrPerMonth: 3_000,
        utilityAddons: [
          {
            utility: UtilityKind.ELECTRICITY,
            name: 'Pemeliharaan Meteran',
            kind: UtilityAddonKind.CONSTANT,
            value: 5_000,
          },
          {
            utility: UtilityKind.WATER,
            name: 'Abodemen',
            kind: UtilityAddonKind.CONSTANT,
            value: 10_000,
          },
        ],
      });

      const createCalls = prisma.unitType.create.mock.calls as Array<
        [CreateWithAddonsArg]
      >;
      const createArg = createCalls[0]?.[0];
      expect(createArg?.data.electricityMinKwh).toBe(52);
      expect(createArg?.data.adminFeeIdrPerMonth).toBe(3_000);
      expect(createArg?.data.utilityAddons?.create).toEqual([
        {
          utility: UtilityKind.ELECTRICITY,
          name: 'Pemeliharaan Meteran',
          kind: UtilityAddonKind.CONSTANT,
          value: 5_000,
          sortOrder: 0,
        },
        {
          utility: UtilityKind.WATER,
          name: 'Abodemen',
          kind: UtilityAddonKind.CONSTANT,
          value: 10_000,
          sortOrder: 0,
        },
      ]);
      expect(created.utilityAddons).toHaveLength(2);
    });

    it('rejects more than 8 electricity add-ons', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      prisma.unitType.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });

      await expect(
        service.create('prop_1', {
          ...studioCreateDto,
          utilityAddons: Array.from({ length: 9 }, (_, i) => ({
            utility: UtilityKind.ELECTRICITY,
            name: `Elec ${i}`,
            kind: UtilityAddonKind.CONSTANT,
            value: 1_000,
          })),
        }),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'utilityAddons',
            reason: ApiFieldReason.UTILITY_ADDON_LIMIT,
          },
        },
      });
      expect(prisma.unitType.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('replace-set deletes then creates add-ons when utilityAddons is provided', async () => {
      prisma.unitType.findUnique.mockResolvedValue(typeRow);
      prisma.unitType.update.mockResolvedValue(typeRow);
      prisma.unitTypeUtilityAddon.deleteMany.mockResolvedValue({ count: 1 });
      prisma.unitTypeUtilityAddon.createMany.mockResolvedValue({ count: 2 });
      prisma.unitType.findUniqueOrThrow.mockResolvedValue({
        ...typeRow,
        _count: { units: 0 },
        adminFeeIdrPerMonth: 3_000,
        utilityAddons: [
          {
            utility: UtilityKind.ELECTRICITY,
            name: 'Handling Charge',
            kind: UtilityAddonKind.PERCENT,
            value: 3,
            sortOrder: 0,
          },
          {
            utility: UtilityKind.WATER,
            name: 'Abodemen',
            kind: UtilityAddonKind.CONSTANT,
            value: 10_000,
            sortOrder: 0,
          },
        ],
      });

      const updated = await service.update('type_1', {
        adminFeeIdrPerMonth: 3_000,
        utilityAddons: [
          {
            utility: UtilityKind.ELECTRICITY,
            name: 'Handling Charge',
            kind: UtilityAddonKind.PERCENT,
            value: 3,
          },
          {
            utility: UtilityKind.WATER,
            name: 'Abodemen',
            kind: UtilityAddonKind.CONSTANT,
            value: 10_000,
          },
        ],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.unitTypeUtilityAddon.deleteMany).toHaveBeenCalledWith({
        where: { unitTypeId: 'type_1' },
      });
      expect(prisma.unitTypeUtilityAddon.createMany).toHaveBeenCalledWith({
        data: [
          {
            unitTypeId: 'type_1',
            utility: UtilityKind.ELECTRICITY,
            name: 'Handling Charge',
            kind: UtilityAddonKind.PERCENT,
            value: 3,
            sortOrder: 0,
          },
          {
            unitTypeId: 'type_1',
            utility: UtilityKind.WATER,
            name: 'Abodemen',
            kind: UtilityAddonKind.CONSTANT,
            value: 10_000,
            sortOrder: 0,
          },
        ],
      });
      expect(updated.adminFeeIdrPerMonth).toBe(3_000);
      expect(updated.utilityAddons).toHaveLength(2);
    });

    it('leaves add-ons unchanged when utilityAddons is omitted', async () => {
      prisma.unitType.findUnique.mockResolvedValue(typeRow);
      prisma.unitType.update.mockResolvedValue({
        ...typeRow,
        name: 'Renamed',
        _count: { units: 2 },
        utilityAddons: [
          {
            utility: UtilityKind.ELECTRICITY,
            name: 'Existing',
            kind: UtilityAddonKind.CONSTANT,
            value: 5_000,
            sortOrder: 0,
          },
        ],
      });

      const updated = await service.update('type_1', { name: 'Renamed' });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.unitTypeUtilityAddon.deleteMany).not.toHaveBeenCalled();
      expect(prisma.unitTypeUtilityAddon.createMany).not.toHaveBeenCalled();
      expect(updated.name).toBe('Renamed');
      expect(updated.utilityAddons).toEqual([
        {
          utility: UtilityKind.ELECTRICITY,
          name: 'Existing',
          kind: UtilityAddonKind.CONSTANT,
          value: 5_000,
          sortOrder: 0,
        },
      ]);
    });
  });

  describe('delete', () => {
    it('blocks when units remain', async () => {
      prisma.unitType.findUnique.mockResolvedValue(typeRow);
      prisma.unit.count.mockResolvedValue(3);

      await expect(service.delete('type_1')).rejects.toMatchObject({
        response: {
          details: {
            reason: ApiFieldReason.HAS_CHILDREN,
            unitCount: 3,
          },
        },
      });
      expect(prisma.unitType.delete).not.toHaveBeenCalled();
    });

    it('404 when missing', async () => {
      prisma.unitType.findUnique.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes when no units', async () => {
      prisma.unitType.findUnique.mockResolvedValue(typeRow);
      prisma.unit.count.mockResolvedValue(0);
      prisma.unitType.delete.mockResolvedValue(typeRow);
      await expect(service.delete('type_1')).resolves.toEqual({ ok: true });
    });
  });

  describe('getRackById', () => {
    it('returns id and all rack prices', async () => {
      prisma.unitType.findUnique.mockResolvedValue({
        id: 'type_1',
        defaultPriceIdr: 400_000,
        monthlyPriceIdr: 10_400_000,
        yearlyPriceIdr: 120_000_000,
        electricityRateIdrPerKwh: 0,
        waterRateIdrPerM3: 0,
        maintenanceFeeIdrPerMonth: 0,
        electricityMinKwh: 0,
        adminFeeIdrPerMonth: 0,
      });
      await expect(service.getRackById('type_1')).resolves.toEqual({
        id: 'type_1',
        defaultPriceIdr: 400_000,
        monthlyPriceIdr: 10_400_000,
        yearlyPriceIdr: 120_000_000,
        electricityRateIdrPerKwh: 0,
        waterRateIdrPerM3: 0,
        maintenanceFeeIdrPerMonth: 0,
        electricityMinKwh: 0,
        adminFeeIdrPerMonth: 0,
      });
      expect(prisma.unitType.findUnique).toHaveBeenCalledWith({
        where: { id: 'type_1' },
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
    });

    it('404 when missing', async () => {
      prisma.unitType.findUnique.mockResolvedValue(null);
      await expect(service.getRackById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
