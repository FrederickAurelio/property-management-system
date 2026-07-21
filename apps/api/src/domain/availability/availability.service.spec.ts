import { Test, TestingModule } from '@nestjs/testing';
import { UnitAvailabilityBlockReason, UnitStatus } from '@cabin/api-contract';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unit: { findMany: jest.Mock; findUnique: jest.Mock };
    reservation: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      property: { findUnique: jest.fn() },
      unit: { findMany: jest.fn(), findUnique: jest.fn() },
      reservation: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AvailabilityService);
  });

  it('returns all units with available + blockReason', async () => {
    prisma.property.findUnique.mockResolvedValue({
      id: 'prop_1',
      isActive: true,
    });
    prisma.unit.findMany.mockResolvedValue([
      {
        id: 'u1',
        propertyId: 'prop_1',
        unitTypeId: 't1',
        code: 'A-101',
        name: null,
        floor: null,
        status: UnitStatus.ACTIVE,
        notes: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        unitType: { isActive: true },
      },
      {
        id: 'u2',
        propertyId: 'prop_1',
        unitTypeId: 't1',
        code: 'A-102',
        name: null,
        floor: null,
        status: UnitStatus.ACTIVE,
        notes: null,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        unitType: { isActive: true },
      },
      {
        id: 'u3',
        propertyId: 'prop_1',
        unitTypeId: 't1',
        code: 'A-103',
        name: null,
        floor: null,
        status: UnitStatus.MAINTENANCE,
        notes: null,
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        unitType: { isActive: true },
      },
    ]);
    prisma.reservation.findMany.mockResolvedValue([{ unitId: 'u1' }]);

    const rows = await service.listAvailableUnits('prop_1', {
      checkInDate: '2026-08-01',
      checkOutDate: '2026-08-03',
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      id: 'u1',
      available: false,
      blockReason: UnitAvailabilityBlockReason.DATE_OVERLAP,
    });
    expect(rows[1]).toMatchObject({
      id: 'u2',
      available: true,
      blockReason: null,
    });
    expect(rows[2]).toMatchObject({
      id: 'u3',
      available: false,
      blockReason: UnitAvailabilityBlockReason.UNIT_NOT_BOOKABLE,
    });
  });

  it('skips DATE_OVERLAP when stay dates omitted', async () => {
    prisma.property.findUnique.mockResolvedValue({
      id: 'prop_1',
      isActive: true,
    });
    prisma.unit.findMany.mockResolvedValue([
      {
        id: 'u1',
        propertyId: 'prop_1',
        unitTypeId: 't1',
        code: 'A-101',
        name: null,
        floor: null,
        status: UnitStatus.ACTIVE,
        notes: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        unitType: { isActive: true },
      },
    ]);

    const rows = await service.listAvailableUnits('prop_1', {});

    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'u1',
        available: true,
        blockReason: null,
      }),
    ]);
  });

  it('marks all units when property inactive', async () => {
    prisma.property.findUnique.mockResolvedValue({
      id: 'prop_1',
      isActive: false,
    });
    prisma.unit.findMany.mockResolvedValue([
      {
        id: 'u1',
        propertyId: 'prop_1',
        unitTypeId: 't1',
        code: 'A-101',
        name: null,
        floor: null,
        status: UnitStatus.ACTIVE,
        notes: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        unitType: { isActive: true },
      },
    ]);
    prisma.reservation.findMany.mockResolvedValue([]);

    const rows = await service.listAvailableUnits('prop_1', {
      checkInDate: '2026-08-01',
      checkOutDate: '2026-08-03',
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'u1',
        available: false,
        blockReason: UnitAvailabilityBlockReason.PROPERTY_INACTIVE,
      }),
    ]);
  });

  it('returns occupying blocks for a calendar month', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'r1',
        checkInDate: new Date('2026-07-28T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-03T00:00:00.000Z'),
      },
    ]);

    const occ = await service.getUnitMonthOccupancy('u1', {
      yearMonth: '2026-08',
    });

    expect(occ).toEqual({
      unitId: 'u1',
      yearMonth: '2026-08',
      blocks: [
        {
          reservationId: 'r1',
          checkInDate: '2026-07-28',
          checkOutDate: '2026-08-03',
        },
      ],
    });
  });
});
