import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApiFieldReason, UnitStatus } from '@cabin/api-contract';
import { UnitsService } from './units.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/index.js';

describe('UnitsService', () => {
  let service: UnitsService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unitType: { findUnique: jest.Mock };
    unit: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const unitRow = {
    id: 'unit_1',
    propertyId: 'prop_1',
    unitTypeId: 'type_1',
    code: 'B-0801',
    name: null,
    floor: '8',
    status: UnitStatus.ACTIVE,
    notes: null,
    sortOrder: 1,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      property: { findUnique: jest.fn() },
      unitType: { findUnique: jest.fn() },
      unit: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UnitsService);
  });

  describe('create', () => {
    it('rejects unit type from another property', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      prisma.unitType.findUnique.mockResolvedValue({
        id: 'type_1',
        propertyId: 'prop_other',
      });

      await expect(
        service.create('prop_1', {
          unitTypeId: 'type_1',
          code: 'X-1',
          status: UnitStatus.ACTIVE,
        }),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'unitTypeId',
            reason: ApiFieldReason.UNIT_TYPE_INVALID,
          },
        },
      });
    });

    it('maps unique code to CODE_TAKEN', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      prisma.unitType.findUnique.mockResolvedValue({
        id: 'type_1',
        propertyId: 'prop_1',
      });
      prisma.unit.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      prisma.unit.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create('prop_1', {
          unitTypeId: 'type_1',
          code: 'B-0801',
          status: UnitStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('delete', () => {
    it('deletes when found', async () => {
      prisma.unit.findUnique.mockResolvedValue(unitRow);
      prisma.unit.delete.mockResolvedValue(unitRow);
      await expect(service.delete('unit_1')).resolves.toEqual({ ok: true });
    });

    it('404 when missing', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps restrict failure to HAS_CHILDREN', async () => {
      prisma.unit.findUnique.mockResolvedValue(unitRow);
      prisma.unit.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );

      await expect(service.delete('unit_1')).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.HAS_CHILDREN },
        },
      });
    });
  });
});
