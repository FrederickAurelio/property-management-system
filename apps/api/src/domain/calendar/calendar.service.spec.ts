import { Test, TestingModule } from '@nestjs/testing';
import {
  ApiFieldReason,
  CalendarBlockKind,
  ReservationSource,
  ReservationStatus,
  UnitStatus,
} from '@cabin/api-contract';
import { BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CalendarService', () => {
  let service: CalendarService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unit: { findMany: jest.Mock; findFirst: jest.Mock };
    reservation: { findMany: jest.Mock; findFirst: jest.Mock };
    calendarBlock: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      property: { findUnique: jest.fn() },
      unit: { findMany: jest.fn(), findFirst: jest.fn() },
      reservation: { findMany: jest.fn(), findFirst: jest.fn() },
      calendarBlock: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CalendarService);
  });

  describe('getPropertyCalendar', () => {
    it('rejects invalid range', async () => {
      await expect(
        service.getPropertyCalendar('prop_1', {
          from: '2026-08-10',
          to: '2026-08-10',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns units, occupying stays, and blocks', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      prisma.unit.findMany.mockResolvedValue([
        {
          id: 'u1',
          code: 'C01',
          name: null,
          status: UnitStatus.ACTIVE,
          sortOrder: 1,
          unitType: { id: 't1', name: 'Deluxe', sortOrder: 1 },
        },
      ]);
      prisma.reservation.findMany.mockResolvedValue([
        {
          id: 'r1',
          unitId: 'u1',
          source: ReservationSource.MANUAL,
          status: ReservationStatus.CONFIRMED,
          checkInDate: new Date('2026-08-01T00:00:00.000Z'),
          checkOutDate: new Date('2026-08-03T00:00:00.000Z'),
          guestName: 'Budi',
          totalAmountIdr: BigInt(500_000),
          paidAmountIdr: BigInt(0),
          paymentStatus: 'UNPAID',
          collectedVia: null,
          icalSyncWarning: null,
          property: { timezone: 'Asia/Jakarta' },
        },
      ]);
      prisma.calendarBlock.findMany.mockResolvedValue([
        {
          id: 'b1',
          propertyId: 'prop_1',
          unitId: 'u1',
          kind: CalendarBlockKind.MAINTENANCE,
          startDate: new Date('2026-08-05T00:00:00.000Z'),
          endDate: new Date('2026-08-07T00:00:00.000Z'),
          note: null,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          updatedAt: new Date('2026-08-01T00:00:00.000Z'),
          createdByAdminId: null,
        },
      ]);

      const cal = await service.getPropertyCalendar('prop_1', {
        from: '2026-08-01',
        to: '2026-08-15',
      });

      expect(cal.units).toHaveLength(1);
      expect(cal.stays).toEqual([
        expect.objectContaining({
          id: 'r1',
          guestName: 'Budi',
          checkInDate: '2026-08-01',
          checkOutDate: '2026-08-03',
        }),
      ]);
      expect(cal.blocks).toEqual([
        expect.objectContaining({
          id: 'b1',
          kind: CalendarBlockKind.MAINTENANCE,
          startDate: '2026-08-05',
          endDate: '2026-08-07',
        }),
      ]);
      expect(prisma.reservation.findMany).toHaveBeenCalled();
    });
  });

  describe('createBlock', () => {
    it('409 when overlapping a stay', async () => {
      prisma.unit.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.$transaction.mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      );
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'r1',
        guestName: 'Budi',
        source: ReservationSource.MANUAL,
        checkInDate: new Date('2026-08-01T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-05T00:00:00.000Z'),
        status: ReservationStatus.CONFIRMED,
      });

      await expect(
        service.createBlock(
          {
            propertyId: 'prop_1',
            unitId: 'u1',
            kind: CalendarBlockKind.HOLD,
            startDate: '2026-08-02',
            endDate: '2026-08-04',
          },
          { id: 'admin_1' },
        ),
      ).rejects.toMatchObject({
        response: {
          details: {
            reason: ApiFieldReason.OVERLAP_CONFLICT,
            field: 'startDate',
            conflictingReservation: { id: 'r1' },
          },
        },
      });
    });

    it('409 when overlapping another block', async () => {
      prisma.unit.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.$transaction.mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      );
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.calendarBlock.findFirst.mockResolvedValue({
        id: 'b1',
        kind: CalendarBlockKind.OWNER,
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-05T00:00:00.000Z'),
      });

      await expect(
        service.createBlock(
          {
            propertyId: 'prop_1',
            unitId: 'u1',
            kind: CalendarBlockKind.MAINTENANCE,
            startDate: '2026-08-02',
            endDate: '2026-08-04',
          },
          { id: 'admin_1' },
        ),
      ).rejects.toMatchObject({
        response: {
          details: {
            reason: ApiFieldReason.OVERLAP_CONFLICT,
            conflictingBlock: { id: 'b1' },
          },
        },
      });
    });

    it('creates a block when free', async () => {
      prisma.unit.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.$transaction.mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      );
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.calendarBlock.findFirst.mockResolvedValue(null);
      const created = {
        id: 'b_new',
        propertyId: 'prop_1',
        unitId: 'u1',
        kind: CalendarBlockKind.MAINTENANCE,
        startDate: new Date('2026-08-10T00:00:00.000Z'),
        endDate: new Date('2026-08-12T00:00:00.000Z'),
        note: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        createdByAdminId: 'admin_1',
      };
      prisma.calendarBlock.create.mockResolvedValue(created);

      const row = await service.createBlock(
        {
          propertyId: 'prop_1',
          unitId: 'u1',
          kind: CalendarBlockKind.MAINTENANCE,
          startDate: '2026-08-10',
          endDate: '2026-08-12',
        },
        { id: 'admin_1' },
      );

      expect(row).toMatchObject({
        id: 'b_new',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        kind: CalendarBlockKind.MAINTENANCE,
      });
    });
  });
});
