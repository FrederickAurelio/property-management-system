import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import {
  ApiFieldReason,
  CancelDisposition,
  PaymentMovementDirection,
  PaymentMovementKind,
  PaymentStatus,
  ReservationBoard,
  ReservationSource,
  ReservationStatus,
  UnitStatus,
  recomputePaymentStatus,
  sumPaidFromMovements,
  signedAmountFor,
  todayYmdInTimezone,
} from '@cabin/api-contract';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReservationsService helpers (contract)', () => {
  it('sums paid from movements', () => {
    expect(
      sumPaidFromMovements([
        { signedAmount: 500_000 },
        { signedAmount: -100_000 },
      ]),
    ).toBe(400_000);
  });

  it('recomputes payment status including complimentary', () => {
    expect(
      recomputePaymentStatus({ totalAmountIdr: 0, paidAmountIdr: 0 }),
    ).toBe(PaymentStatus.PAID);
    expect(
      recomputePaymentStatus({
        totalAmountIdr: 1_000_000,
        paidAmountIdr: 200_000,
      }),
    ).toBe(PaymentStatus.DEPOSIT);
    expect(
      recomputePaymentStatus({
        totalAmountIdr: 1_000_000,
        paidAmountIdr: 0,
        forceRefunded: true,
      }),
    ).toBe(PaymentStatus.REFUNDED);
  });

  it('signedAmountFor direction', () => {
    expect(signedAmountFor(PaymentMovementDirection.IN, 100)).toBe(100);
    expect(signedAmountFor(PaymentMovementDirection.OUT, 100)).toBe(-100);
  });
});

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: {
    reservation: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    paymentMovement: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    unit: { findUnique: jest.Mock };
    unitType: { findUnique: jest.Mock };
    property: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  const actor = { id: 'admin_1' };

  const unitBookable = {
    id: 'unit_1',
    propertyId: 'prop_1',
    unitTypeId: 'type_1',
    status: UnitStatus.ACTIVE,
    property: { id: 'prop_1', isActive: true },
    unitType: {
      id: 'type_1',
      propertyId: 'prop_1',
      isActive: true,
      maxGuests: 4,
    },
  };

  beforeEach(async () => {
    prisma = {
      reservation: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      paymentMovement: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      unit: { findUnique: jest.fn() },
      unitType: { findUnique: jest.fn() },
      property: { findUnique: jest.fn() },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ReservationsService);
  });

  describe('create', () => {
    it('rejects incomplete confirm matrix', async () => {
      prisma.unit.findUnique.mockResolvedValue(unitBookable);

      await expect(
        service.create(
          {
            propertyId: 'prop_1',
            unitId: 'unit_1',
            unitTypeId: 'type_1',
            source: ReservationSource.MANUAL,
            checkInDate: '2026-08-01',
            checkOutDate: '2026-08-03',
            guestName: 'Guest (iCal)',
            guestEmail: null,
            guestPhone: null,
            guestCount: 2,
            totalAmountIdr: 1_000_000,
            depositAmountIdr: 0,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.CONFIRM_INCOMPLETE },
        },
      });
    });

    it('409 on overlap', async () => {
      prisma.unit.findUnique.mockResolvedValue(unitBookable);
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res_other',
        guestName: 'Busy Guest',
        source: ReservationSource.AIRBNB,
        checkInDate: new Date('2026-08-01T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-05T00:00:00.000Z'),
        status: ReservationStatus.CONFIRMED,
      });

      await expect(
        service.create(
          {
            propertyId: 'prop_1',
            unitId: 'unit_1',
            unitTypeId: 'type_1',
            source: ReservationSource.MANUAL,
            checkInDate: '2026-08-02',
            checkOutDate: '2026-08-04',
            guestName: 'Walk In',
            guestEmail: 'a@b.com',
            guestPhone: null,
            guestCount: 2,
            totalAmountIdr: 1_000_000,
            depositAmountIdr: 0,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects guestCount above unit type max', async () => {
      prisma.unit.findUnique.mockResolvedValue(unitBookable);

      await expect(
        service.create(
          {
            propertyId: 'prop_1',
            unitId: 'unit_1',
            unitTypeId: 'type_1',
            source: ReservationSource.MANUAL,
            checkInDate: '2026-08-01',
            checkOutDate: '2026-08-03',
            guestName: 'Walk In',
            guestEmail: 'a@b.com',
            guestPhone: null,
            guestCount: 9,
            totalAmountIdr: 1_000_000,
            depositAmountIdr: 0,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.GUEST_COUNT_EXCEEDS_MAX },
        },
      });
    });
  });

  describe('update', () => {
    it('rejects guestCount above unit type max', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        status: ReservationStatus.CONFIRMED,
        checkInDate: new Date('2026-08-01T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-03T00:00:00.000Z'),
        guestCount: 2,
        property: { timezone: 'Asia/Jakarta' },
      });
      prisma.unitType.findUnique.mockResolvedValue({ maxGuests: 4 });

      await expect(
        service.update('res_1', { guestCount: 8 }, actor),
      ).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.GUEST_COUNT_EXCEEDS_MAX },
        },
      });
    });
  });

  describe('cancel', () => {
    it('requires disposition when paid > 0', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res_1',
        status: ReservationStatus.CONFIRMED,
        paidAmountIdr: BigInt(500_000),
        collectedVia: null,
      });

      await expect(
        service.cancel('res_1', { disposition: CancelDisposition.none }, actor),
      ).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.CANCEL_DISPOSITION_REQUIRED },
        },
      });
    });
  });

  describe('postMovement', () => {
    it('rejects IN over Due', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res_1',
        status: ReservationStatus.CONFIRMED,
        totalAmountIdr: BigInt(1_000_000),
        paidAmountIdr: BigInt(800_000),
      });

      await expect(
        service.postMovement(
          'res_1',
          {
            direction: PaymentMovementDirection.IN,
            kind: PaymentMovementKind.TOP_UP,
            amountIdr: 300_000,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.MOVEMENT_EXCEEDS_DUE },
        },
      });
    });
  });

  describe('checkIn', () => {
    it('requires confirmEarly outside window', async () => {
      const farFuture = '2099-01-15';
      const row = {
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        checkInDate: new Date(`${farFuture}T00:00:00.000Z`),
        checkOutDate: new Date('2099-01-20T00:00:00.000Z'),
        guestName: 'Walk In',
        guestEmail: 'a@b.com',
        guestPhone: null,
        guestCount: 2,
        notes: null,
        totalAmountIdr: BigInt(1_000_000),
        paidAmountIdr: BigInt(0),
        paymentStatus: PaymentStatus.UNPAID,
        collectedVia: null,
        externalRef: null,
        icalSyncWarning: null,
        icalSyncWarnedAt: null,
        confirmedAt: new Date(),
        checkedInAt: null,
        checkedOutAt: null,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByAdminId: actor.id,
        updatedByAdminId: actor.id,
        property: { name: 'Sky', timezone: 'Asia/Jakarta' },
        unit: { code: 'B-0801' },
        createdByAdmin: { username: 'desk' },
        updatedByAdmin: { username: 'desk' },
        movements: [],
      };

      prisma.reservation.findUnique.mockResolvedValueOnce(row);
      await expect(service.checkIn('res_1', {}, actor)).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.EARLY_CONFIRM_REQUIRED },
        },
      });

      prisma.reservation.findUnique
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce({
          ...row,
          status: ReservationStatus.CHECKED_IN,
          checkedInAt: new Date(),
        });
      prisma.reservation.update.mockResolvedValue({});

      const checkedIn = await service.checkIn(
        'res_1',
        { confirmEarly: true },
        actor,
      );
      expect(checkedIn.status).toBe(ReservationStatus.CHECKED_IN);
    });
  });

  describe('list board=arrivals', () => {
    it('filters CONFIRMED in check-in window (overdue inclusive)', async () => {
      const timezone = 'Asia/Jakarta';
      const today = todayYmdInTimezone(timezone);
      const todayDate = new Date(`${today}T00:00:00.000Z`);

      prisma.property.findUnique.mockResolvedValue({ timezone });
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.list({
        board: ReservationBoard.arrivals,
        propertyId: 'prop_1',
        page: 1,
        pageSize: 20,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            propertyId: 'prop_1',
            status: ReservationStatus.CONFIRMED,
            checkInDate: { lte: todayDate },
            checkOutDate: { gt: todayDate },
          },
        }),
      );
    });
  });

  describe('list board=departures', () => {
    it('filters CHECKED_IN with checkOutDate ≤ today (overdue inclusive)', async () => {
      const timezone = 'Asia/Jakarta';
      const today = todayYmdInTimezone(timezone);
      const todayDate = new Date(`${today}T00:00:00.000Z`);

      prisma.property.findUnique.mockResolvedValue({ timezone });
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.list({
        board: ReservationBoard.departures,
        propertyId: 'prop_1',
        page: 1,
        pageSize: 20,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            propertyId: 'prop_1',
            status: ReservationStatus.CHECKED_IN,
            checkOutDate: { lte: todayDate },
          },
          orderBy: [{ checkOutDate: 'asc' }, { createdAt: 'asc' }],
        }),
      );
    });
  });
});
