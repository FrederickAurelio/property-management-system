import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApiFieldReason } from '@cabin/api-contract';
import { PropertiesService } from './properties.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/index.js';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let prisma: {
    property: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    unitType: { count: jest.Mock };
    unit: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  const propertyRow = {
    id: 'prop_1',
    code: 'SKY',
    name: 'Sky',
    timezone: 'Asia/Jakarta',
    checkInFrom: null,
    checkInUntil: null,
    checkOutFrom: null,
    checkOutUntil: null,
    addressLine: null,
    city: 'Medan',
    countryCode: 'ID',
    latitude: null,
    longitude: null,
    googlePlaceId: null,
    coverImage: null,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      property: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      unitType: { count: jest.fn() },
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
        PropertiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PropertiesService);
  });

  describe('listOptions', () => {
    it('returns id and name only, ordered by name', async () => {
      prisma.property.findMany.mockResolvedValue([
        { id: 'prop_a', name: 'Alpha' },
        { id: 'prop_b', name: 'Beta' },
      ]);

      await expect(service.listOptions()).resolves.toEqual([
        { id: 'prop_a', name: 'Alpha' },
        { id: 'prop_b', name: 'Beta' },
      ]);
      expect(prisma.property.findMany).toHaveBeenCalledWith({
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('delete', () => {
    it('blocks when children remain', async () => {
      prisma.property.findUnique.mockResolvedValue(propertyRow);
      prisma.unitType.count.mockResolvedValue(2);
      prisma.unit.count.mockResolvedValue(5);

      await expect(service.delete('prop_1')).rejects.toMatchObject({
        response: {
          details: {
            field: 'id',
            reason: ApiFieldReason.HAS_CHILDREN,
            typeCount: 2,
            unitCount: 5,
          },
        },
      });
      expect(prisma.property.delete).not.toHaveBeenCalled();
    });

    it('deletes when empty', async () => {
      prisma.property.findUnique.mockResolvedValue(propertyRow);
      prisma.unitType.count.mockResolvedValue(0);
      prisma.unit.count.mockResolvedValue(0);
      prisma.property.delete.mockResolvedValue(propertyRow);

      await expect(service.delete('prop_1')).resolves.toEqual({ ok: true });
    });

    it('404 when missing', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('maps unique code to CODE_TAKEN', async () => {
      prisma.property.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create({
          code: 'SKY',
          name: 'Sky',
          timezone: 'Asia/Jakarta',
        }),
      ).rejects.toMatchObject({
        response: {
          details: { field: 'code', reason: ApiFieldReason.CODE_TAKEN },
        },
      });
    });

    it('maps incomplete lat/lng pair to LAT_LNG_PAIR_REQUIRED on missing field', async () => {
      await expect(
        service.create({
          code: 'SKY',
          name: 'Sky',
          timezone: 'Asia/Jakarta',
          latitude: 3.5,
          longitude: null,
        }),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'longitude',
            reason: ApiFieldReason.LAT_LNG_PAIR_REQUIRED,
          },
        },
      });
      expect(prisma.property.create).not.toHaveBeenCalled();
    });
  });
});
