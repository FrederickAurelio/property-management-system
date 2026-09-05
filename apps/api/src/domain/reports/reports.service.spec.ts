import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unit: { findMany: jest.Mock };
    reservation: { findMany: jest.Mock };
    propertyExpense: { groupBy: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      property: { findUnique: jest.fn() },
      unit: { findMany: jest.fn() },
      reservation: { findMany: jest.fn().mockResolvedValue([]) },
      propertyExpense: { groupBy: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ReportsService);
  });

  it('rejects from after to', async () => {
    await expect(
      service.getSummary({
        propertyId: 'p1',
        from: '2026-07-10',
        to: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects span over 366 days', async () => {
    await expect(
      service.getSummary({
        propertyId: 'p1',
        from: '2025-01-01',
        to: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 when property missing', async () => {
    prisma.property.findUnique.mockResolvedValue(null);
    await expect(
      service.getSummary({
        propertyId: 'missing',
        from: '2026-07-01',
        to: '2026-07-07',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns empty summary skeleton for property with no activity', async () => {
    prisma.property.findUnique.mockResolvedValue({
      id: 'p1',
      timezone: 'Asia/Jakarta',
    });
    prisma.unit.findMany.mockResolvedValue([
      {
        id: 'u1',
        code: 'D1',
        name: null,
        sortOrder: 1,
        unitTypeId: 't1',
        unitType: { id: 't1', name: 'Deluxe', sortOrder: 1 },
      },
    ]);

    const summary = await service.getSummary({
      propertyId: 'p1',
      from: '2026-07-01',
      to: '2026-07-07',
      compare: true,
    });

    expect(summary.propertyId).toBe('p1');
    expect(summary.compare).toEqual({ from: '2026-06-24', to: '2026-06-30' });
    expect(summary.cash.inIdr).toBe(0);
    expect(summary.cash.bySource).toHaveLength(5);
    expect(summary.occupancyByUnitType).toHaveLength(1);
    expect(summary.occupancyByUnitType[0]?.units[0]?.name).toBe('D1');
    expect(summary.sourceMix).toHaveLength(5);
    expect(summary.cash.guestInIdr).toBe(0);
    expect(summary.cash.expenseOutIdr).toBe(0);
    expect(summary.cash.billed.totalIdr).toBe(0);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
