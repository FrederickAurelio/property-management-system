import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApiFieldReason, UnitLayout } from '@cabin/api-contract';
import { UnitTypesService } from './unit-types.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UnitTypesService', () => {
  let service: UnitTypesService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unitType: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
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
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
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

      const created = await service.create('prop_1', {
        code: 'DLX',
        name: 'Studio',
        layout: UnitLayout.STUDIO,
        bathroomCount: 1,
        maxGuests: 2,
        defaultPriceIdr: 400_000,
        bedConfig: [
          { room: 'Studio', beds: [{ type: 'LARGE_DOUBLE', count: 1 }] },
        ],
      });

      const createCalls = prisma.unitType.create.mock.calls as Array<
        [{ data: { bedroomCount: number } }]
      >;
      expect(createCalls[0]?.[0].data.bedroomCount).toBe(0);
      expect(created.bedroomCount).toBe(0);
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
});
