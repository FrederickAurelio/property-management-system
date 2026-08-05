import { Test, TestingModule } from '@nestjs/testing';
import { UnitAvailabilityBlockReason, UnitStatus } from '@cabin/api-contract';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unit: { findMany: jest.Mock; findUnique: jest.Mock };
    reservation: { findMany: jest.Mock; aggregate: jest.Mock };
    calendarBlock: { findMany: jest.Mock; aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      property: { findUnique: jest.fn() },
      unit: { findMany: jest.fn(), findUnique: jest.fn() },
      reservation: {
        findMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { inventoryEndDate: null } }),
      },
      calendarBlock: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { endDate: null } }),
      },
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

  it('marks DATE_OVERLAP when a calendar block occupies the range', async () => {
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
    prisma.reservation.findMany.mockResolvedValue([]);
    prisma.calendarBlock.findMany.mockResolvedValue([{ unitId: 'u1' }]);

    const rows = await service.listAvailableUnits('prop_1', {
      checkInDate: '2026-08-01',
      checkOutDate: '2026-08-03',
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'u1',
        available: false,
        blockReason: UnitAvailabilityBlockReason.DATE_OVERLAP,
      }),
    ]);
  });

  it('returns occupying stays and calendar blocks for a calendar month', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'r1',
        checkInDate: new Date('2026-07-28T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-03T00:00:00.000Z'),
        inventoryEndDate: new Date('2026-08-03T00:00:00.000Z'),
      },
    ]);
    prisma.calendarBlock.findMany.mockResolvedValue([
      {
        id: 'b1',
        startDate: new Date('2026-08-10T00:00:00.000Z'),
        endDate: new Date('2026-08-12T00:00:00.000Z'),
      },
    ]);
    prisma.reservation.aggregate.mockResolvedValue({
      _max: { inventoryEndDate: new Date('2026-08-03T00:00:00.000Z') },
    });
    prisma.calendarBlock.aggregate.mockResolvedValue({
      _max: { endDate: new Date('2026-08-12T00:00:00.000Z') },
    });

    const occ = await service.getUnitMonthOccupancy('u1', {
      yearMonth: '2026-08',
    });

    expect(occ).toEqual({
      unitId: 'u1',
      yearMonth: '2026-08',
      from: '2026-08-01',
      to: '2026-09-01',
      blocks: [
        {
          reservationId: 'r1',
          checkInDate: '2026-07-28',
          checkOutDate: '2026-08-03',
          contractCheckOutDate: '2026-08-03',
        },
        {
          reservationId: 'b1',
          checkInDate: '2026-08-10',
          checkOutDate: '2026-08-12',
        },
      ],
      openHoldBlockedBefore: '2026-08-12',
    });
  });

  it('maps monthly open hold inventoryEndDate as occupancy busy end', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'r_monthly',
        checkInDate: new Date('2026-05-24T00:00:00.000Z'),
        checkOutDate: new Date('2026-06-24T00:00:00.000Z'),
        inventoryEndDate: new Date('9999-12-31T00:00:00.000Z'),
      },
    ]);
    prisma.calendarBlock.findMany.mockResolvedValue([]);
    prisma.reservation.aggregate.mockResolvedValue({
      _max: { inventoryEndDate: new Date('9999-12-31T00:00:00.000Z') },
    });

    const occ = await service.getUnitMonthOccupancy('u1', {
      yearMonth: '2026-07',
    });

    // FAR clipped with one-month spill spare (Aug spill on a July grid)
    expect(occ.blocks).toEqual([
      {
        reservationId: 'r_monthly',
        checkInDate: '2026-05-24',
        checkOutDate: '2026-09-01',
        contractCheckOutDate: '2026-06-24',
      },
    ]);
    expect(occ.from).toBe('2026-07-01');
    expect(occ.to).toBe('2026-08-01');
    expect(occ.openHoldBlockedBefore).toBe('9999-12-31');
    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inventoryEndDate: { gt: expect.any(Date) },
        }),
      }),
    );
  });

  it('loads a from/to range in one query and clips FAR to `to`', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'r_monthly',
        checkInDate: new Date('2026-05-24T00:00:00.000Z'),
        checkOutDate: new Date('2026-06-24T00:00:00.000Z'),
        inventoryEndDate: new Date('9999-12-31T00:00:00.000Z'),
      },
    ]);
    prisma.calendarBlock.findMany.mockResolvedValue([]);
    prisma.reservation.aggregate.mockResolvedValue({
      _max: { inventoryEndDate: new Date('9999-12-31T00:00:00.000Z') },
    });

    const occ = await service.getUnitMonthOccupancy('u1', {
      from: '2026-01-01',
      to: '2027-02-01',
    });

    expect(occ).toEqual({
      unitId: 'u1',
      yearMonth: '2026-01',
      from: '2026-01-01',
      to: '2027-02-01',
      blocks: [
        {
          reservationId: 'r_monthly',
          checkInDate: '2026-05-24',
          checkOutDate: '2027-02-01',
          contractCheckOutDate: '2026-06-24',
        },
      ],
      openHoldBlockedBefore: '9999-12-31',
    });
  });

  it('returns openHoldBlockedBefore from unit-wide MAX even outside the window', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
    // Window is 2026 only — next-year daily is not in blocks.
    prisma.reservation.findMany.mockResolvedValue([]);
    prisma.calendarBlock.findMany.mockResolvedValue([]);
    prisma.reservation.aggregate.mockResolvedValue({
      _max: { inventoryEndDate: new Date('2027-05-20T00:00:00.000Z') },
    });

    const occ = await service.getUnitMonthOccupancy('u1', {
      from: '2026-01-01',
      to: '2027-02-01',
    });

    expect(occ.blocks).toEqual([]);
    expect(occ.openHoldBlockedBefore).toBe('2027-05-20');
  });

  it('returns null openHoldBlockedBefore when unit has no occupying inventory', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.reservation.findMany.mockResolvedValue([]);
    prisma.calendarBlock.findMany.mockResolvedValue([]);

    const occ = await service.getUnitMonthOccupancy('u1', {
      yearMonth: '2026-08',
    });

    expect(occ.openHoldBlockedBefore).toBeNull();
  });

  it('rejects occupancy from/to longer than UNIT_OCCUPANCY_RANGE_MAX_YEARS', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.getUnitMonthOccupancy('u1', {
        from: '2020-01-01',
        to: '2027-01-02',
      }),
    ).rejects.toThrow(/cannot exceed/);
  });

  it('rejects from without to even when yearMonth is also set', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.getUnitMonthOccupancy('u1', {
        from: '2026-01-01',
        yearMonth: '2026-07',
      }),
    ).rejects.toThrow('Provide both from and to, or yearMonth alone');
  });

  it('rejects to without from', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.getUnitMonthOccupancy('u1', {
        to: '2026-08-01',
        yearMonth: '2026-07',
      }),
    ).rejects.toThrow('Provide both from and to, or yearMonth alone');
  });
});
