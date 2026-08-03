import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import {
  ApiFieldReason,
  CancelDisposition,
  IcalSyncWarning,
  PaymentMovementDirection,
  PaymentMovementKind,
  PaymentStatus,
  ReservationBoard,
  ReservationSource,
  ReservationStatus,
  StayBillingPeriod,
  UnitStatus,
  recomputePaymentStatus,
  sumPaidFromMovements,
  signedAmountFor,
  todayYmdInTimezone,
} from '@cabin/api-contract';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IcalImportService } from '../ical/ical-import.service';

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
  let icalImport: {
    fetchEventDatesForUid: jest.Mock;
    syncAll: jest.Mock;
  };
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
    calendarBlock: { findFirst: jest.Mock };
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
      calendarBlock: { findFirst: jest.fn().mockResolvedValue(null) },
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

    icalImport = {
      fetchEventDatesForUid: jest.fn(),
      syncAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: IcalImportService,
          useValue: icalImport,
        },
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
            billingPeriod: StayBillingPeriod.DAILY,
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

    it('rejects monthly date mismatch', async () => {
      prisma.unit.findUnique.mockResolvedValue(unitBookable);

      await expect(
        service.create(
          {
            propertyId: 'prop_1',
            unitId: 'unit_1',
            unitTypeId: 'type_1',
            source: ReservationSource.MANUAL,
            billingPeriod: StayBillingPeriod.MONTHLY,
            checkInDate: '2026-06-26',
            checkOutDate: '2026-07-27',
            guestName: 'Walk In',
            guestEmail: 'a@b.com',
            guestPhone: null,
            guestCount: 2,
            totalAmountIdr: 16_900_000,
            depositAmountIdr: 0,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'checkOutDate',
            reason: ApiFieldReason.STAY_PERIOD_MISMATCH,
          },
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
            billingPeriod: StayBillingPeriod.DAILY,
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
            billingPeriod: StayBillingPeriod.DAILY,
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
        billingPeriod: StayBillingPeriod.DAILY,
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

    it('rejects monthly period mismatch on date patch', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        status: ReservationStatus.CONFIRMED,
        billingPeriod: StayBillingPeriod.MONTHLY,
        checkInDate: new Date('2026-06-26T00:00:00.000Z'),
        checkOutDate: new Date('2026-07-26T00:00:00.000Z'),
        guestCount: 2,
        property: { timezone: 'Asia/Jakarta' },
      });
      prisma.unit.findUnique.mockResolvedValue(unitBookable);

      await expect(
        service.update('res_1', { checkOutDate: '2026-07-27' }, actor),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'checkOutDate',
            reason: ApiFieldReason.STAY_PERIOD_MISMATCH,
          },
        },
      });
    });

    function detailRow(
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        billingPeriod: StayBillingPeriod.DAILY,
        checkInDate: new Date('2026-08-15T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-18T00:00:00.000Z'),
        guestName: 'Maria Santos',
        guestEmail: 'a@b.com',
        guestPhone: null,
        guestCount: 2,
        notes: null,
        totalAmountIdr: BigInt(1_000_000),
        paidAmountIdr: BigInt(0),
        paymentStatus: PaymentStatus.UNPAID,
        collectedVia: null,
        externalRef: 'cabin-demo-001',
        icalSyncWarning: null,
        icalSyncWarnedAt: null,
        icalOverlapHold: false,
        icalObservedUnitId: null,
        icalObservedCheckInDate: null,
        icalObservedCheckOutDate: null,
        icalOtaStillListedDismissedAt: null,
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
        icalObservedUnit: null,
        createdByAdmin: { username: 'desk' },
        updatedByAdmin: { username: 'desk' },
        movements: [],
        ...overrides,
      };
    }

    it('clears IMPORT_OVERLAP + hold when date patch lands on free nights', async () => {
      const existing = detailRow({
        status: ReservationStatus.UNCONFIRMED,
        icalSyncWarning: IcalSyncWarning.IMPORT_OVERLAP,
        icalOverlapHold: true,
        confirmedAt: null,
      });
      prisma.reservation.findUnique
        .mockResolvedValueOnce({
          ...existing,
          property: { timezone: 'Asia/Jakarta' },
        })
        .mockResolvedValueOnce({
          ...existing,
          checkInDate: new Date('2026-08-20T00:00:00.000Z'),
          checkOutDate: new Date('2026-08-22T00:00:00.000Z'),
          icalSyncWarning: null,
          icalOverlapHold: false,
        });
      prisma.unit.findUnique.mockResolvedValue(unitBookable);

      await service.update(
        'res_1',
        { checkInDate: '2026-08-20', checkOutDate: '2026-08-22' },
        actor,
      );

      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            icalSyncWarning: null,
            icalSyncWarnedAt: null,
            icalOverlapHold: false,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('clears DATES_DIFFER when patched dates match OTA feed', async () => {
      const existing = detailRow({
        icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
        icalSyncWarnedAt: new Date(),
      });
      prisma.reservation.findUnique
        .mockResolvedValueOnce({
          ...existing,
          property: { timezone: 'Asia/Jakarta' },
        })
        .mockResolvedValueOnce({
          ...existing,
          checkInDate: new Date('2026-08-16T00:00:00.000Z'),
          checkOutDate: new Date('2026-08-19T00:00:00.000Z'),
          icalSyncWarning: null,
        });
      prisma.unit.findUnique.mockResolvedValue(unitBookable);
      icalImport.fetchEventDatesForUid.mockResolvedValue({
        kind: 'found',
        checkInDate: '2026-08-16',
        checkOutDate: '2026-08-19',
        unitId: 'unit_1',
      });

      await service.update(
        'res_1',
        { checkInDate: '2026-08-16', checkOutDate: '2026-08-19' },
        actor,
      );

      expect(icalImport.fetchEventDatesForUid).toHaveBeenCalled();
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            icalSyncWarning: null,
            icalSyncWarnedAt: null,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('keeps DATES_DIFFER when patched dates still differ from OTA', async () => {
      const existing = detailRow({
        icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
        icalSyncWarnedAt: new Date(),
      });
      prisma.reservation.findUnique
        .mockResolvedValueOnce({
          ...existing,
          property: { timezone: 'Asia/Jakarta' },
        })
        .mockResolvedValueOnce({
          ...existing,
          checkInDate: new Date('2026-08-17T00:00:00.000Z'),
          checkOutDate: new Date('2026-08-20T00:00:00.000Z'),
        });
      prisma.unit.findUnique.mockResolvedValue(unitBookable);
      icalImport.fetchEventDatesForUid.mockResolvedValue({
        kind: 'found',
        checkInDate: '2026-08-16',
        checkOutDate: '2026-08-19',
        unitId: 'unit_1',
      });

      await service.update(
        'res_1',
        { checkInDate: '2026-08-17', checkOutDate: '2026-08-20' },
        actor,
      );

      const updateCalls = prisma.reservation.update.mock.calls as Array<
        [{ data?: Record<string, unknown> }]
      >;
      expect(updateCalls[0]?.[0]?.data?.icalSyncWarning).toBeUndefined();
    });

    it('keeps MISSING_FROM_FEED on date patch', async () => {
      const existing = detailRow({
        icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
        icalSyncWarnedAt: new Date(),
      });
      prisma.reservation.findUnique
        .mockResolvedValueOnce({
          ...existing,
          property: { timezone: 'Asia/Jakarta' },
        })
        .mockResolvedValueOnce(existing);
      prisma.unit.findUnique.mockResolvedValue(unitBookable);

      await service.update(
        'res_1',
        { checkInDate: '2026-08-15', checkOutDate: '2026-08-19' },
        actor,
      );

      expect(icalImport.fetchEventDatesForUid).not.toHaveBeenCalled();
      const updateCalls = prisma.reservation.update.mock.calls as Array<
        [{ data?: Record<string, unknown> }]
      >;
      expect(updateCalls[0]?.[0]?.data?.icalSyncWarning).toBeUndefined();
    });
    it('rejects source change when externalRef is set', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...detailRow({
          externalRef: 'cabin-demo-001',
          source: ReservationSource.AIRBNB,
        }),
        property: { timezone: 'Asia/Jakarta' },
      });

      await expect(
        service.update('res_1', { source: ReservationSource.MANUAL }, actor),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'source',
            reason: ApiFieldReason.SOURCE_LOCKED_WITH_EXTERNAL_REF,
          },
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

    it('clears ical warning + hold on cancel', async () => {
      const row = {
        id: 'res_1',
        status: ReservationStatus.CONFIRMED,
        paidAmountIdr: BigInt(0),
        collectedVia: null,
        icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
        icalOverlapHold: false,
      };
      prisma.reservation.findUnique
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce({
          ...row,
          status: ReservationStatus.CANCELLED,
          icalSyncWarning: null,
          cancelledAt: new Date(),
          propertyId: 'prop_1',
          unitId: 'unit_1',
          unitTypeId: 'type_1',
          source: ReservationSource.AIRBNB,
          billingPeriod: StayBillingPeriod.DAILY,
          checkInDate: new Date('2026-08-15T00:00:00.000Z'),
          checkOutDate: new Date('2026-08-18T00:00:00.000Z'),
          guestName: 'Maria',
          guestEmail: null,
          guestPhone: null,
          guestCount: 2,
          notes: null,
          totalAmountIdr: BigInt(1_000_000),
          paymentStatus: PaymentStatus.UNPAID,
          externalRef: 'cabin-demo-001',
          icalSyncWarnedAt: null,
          icalOtaStillListedDismissedAt: null,
          confirmedAt: new Date(),
          checkedInAt: null,
          checkedOutAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdByAdminId: actor.id,
          updatedByAdminId: actor.id,
          property: { name: 'Sky', timezone: 'Asia/Jakarta' },
          unit: { code: 'B-0801' },
          createdByAdmin: { username: 'desk' },
          updatedByAdmin: { username: 'desk' },
          movements: [],
        });
      prisma.reservation.findUniqueOrThrow.mockResolvedValue({
        totalAmountIdr: BigInt(1_000_000),
      });

      await service.cancel(
        'res_1',
        { disposition: CancelDisposition.none },
        actor,
      );

      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ReservationStatus.CANCELLED,
            icalSyncWarning: null,
            icalSyncWarnedAt: null,
            icalOverlapHold: false,
            icalObservedUnitId: null,
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('acceptIcalUnit', () => {
    const targetUnit = {
      id: 'unit_2',
      propertyId: 'prop_1',
      unitTypeId: 'type_2',
      status: 'ACTIVE',
      property: { id: 'prop_1', isActive: true },
      unitType: { id: 'type_2', isActive: true },
    };

    it('moves reservation to observed unit when nights are free', async () => {
      const existing = {
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        checkInDate: new Date('2026-08-15T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-18T00:00:00.000Z'),
        externalRef: 'cabin-demo-moved',
        icalSyncWarning: IcalSyncWarning.UNIT_DIFFER,
        icalObservedUnitId: 'unit_2',
        icalObservedCheckInDate: new Date('2026-08-15T00:00:00.000Z'),
        icalObservedCheckOutDate: new Date('2026-08-18T00:00:00.000Z'),
      };
      prisma.reservation.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          unitId: 'unit_2',
          unitTypeId: 'type_2',
          icalSyncWarning: null,
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
          billingPeriod: StayBillingPeriod.DAILY,
          guestName: 'Moved',
          guestEmail: null,
          guestPhone: null,
          guestCount: 2,
          notes: null,
          totalAmountIdr: BigInt(1_000_000),
          paidAmountIdr: BigInt(0),
          paymentStatus: PaymentStatus.UNPAID,
          collectedVia: null,
          icalSyncWarnedAt: null,
          icalOverlapHold: false,
          icalOtaStillListedDismissedAt: null,
          confirmedAt: new Date(),
          checkedInAt: null,
          checkedOutAt: null,
          cancelledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdByAdminId: actor.id,
          updatedByAdminId: actor.id,
          property: { name: 'Sky', timezone: 'Asia/Jakarta' },
          unit: { code: 'B-0802' },
          icalObservedUnit: null,
          createdByAdmin: { username: 'desk' },
          updatedByAdmin: { username: 'desk' },
          movements: [],
        });
      prisma.unit.findUnique.mockResolvedValue(targetUnit);

      await service.acceptIcalUnit('res_1', actor);

      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitId: 'unit_2',
            unitTypeId: 'type_2',
            icalSyncWarning: null,
            icalObservedUnitId: null,
            icalOverlapHold: false,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('sets DATES_DIFFER after accept when OTA dates also differ', async () => {
      const existing = {
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        checkInDate: new Date('2026-08-15T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-18T00:00:00.000Z'),
        externalRef: 'cabin-demo-moved',
        icalSyncWarning: IcalSyncWarning.UNIT_DIFFER,
        icalObservedUnitId: 'unit_2',
        icalObservedCheckInDate: new Date('2026-08-16T00:00:00.000Z'),
        icalObservedCheckOutDate: new Date('2026-08-19T00:00:00.000Z'),
      };
      prisma.reservation.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          unitId: 'unit_2',
          unitTypeId: 'type_2',
          icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
          icalObservedUnitId: null,
          billingPeriod: StayBillingPeriod.DAILY,
          guestName: 'Moved',
          guestEmail: null,
          guestPhone: null,
          guestCount: 2,
          notes: null,
          totalAmountIdr: BigInt(1_000_000),
          paidAmountIdr: BigInt(0),
          paymentStatus: PaymentStatus.UNPAID,
          collectedVia: null,
          icalSyncWarnedAt: new Date(),
          icalOverlapHold: false,
          icalOtaStillListedDismissedAt: null,
          confirmedAt: new Date(),
          checkedInAt: null,
          checkedOutAt: null,
          cancelledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdByAdminId: actor.id,
          updatedByAdminId: actor.id,
          property: { name: 'Sky', timezone: 'Asia/Jakarta' },
          unit: { code: 'B-0802' },
          icalObservedUnit: null,
          createdByAdmin: { username: 'desk' },
          updatedByAdmin: { username: 'desk' },
          movements: [],
        });
      prisma.unit.findUnique.mockResolvedValue(targetUnit);

      await service.acceptIcalUnit('res_1', actor);

      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitId: 'unit_2',
            icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
            icalObservedCheckInDate: expect.any(Date) as Date,
            icalObservedCheckOutDate: expect.any(Date) as Date,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('rejects when target nights overlap', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        checkInDate: new Date('2026-08-15T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-18T00:00:00.000Z'),
        externalRef: 'cabin-demo-moved',
        icalSyncWarning: IcalSyncWarning.UNIT_DIFFER,
        icalObservedUnitId: 'unit_2',
        icalObservedCheckInDate: new Date('2026-08-15T00:00:00.000Z'),
        icalObservedCheckOutDate: new Date('2026-08-18T00:00:00.000Z'),
      });
      prisma.unit.findUnique.mockResolvedValue(targetUnit);
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res_other',
        guestName: 'Other',
        source: ReservationSource.MANUAL,
        checkInDate: new Date('2026-08-15T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-18T00:00:00.000Z'),
        status: ReservationStatus.CONFIRMED,
      });

      await expect(
        service.acceptIcalUnit('res_1', actor),
      ).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.OVERLAP_CONFLICT },
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
        icalOverlapHold: false,
        icalOtaStillListedDismissedAt: null,
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

  describe('list stay-touch from/to', () => {
    it('ANDs inclusive checkIn ≤ to and checkOut ≥ from', async () => {
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.list({
        board: ReservationBoard.all,
        from: '2026-05-02',
        to: '2026-05-28',
        page: 1,
        pageSize: 20,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {},
              {
                AND: [
                  {
                    checkInDate: { lte: new Date('2026-05-28T00:00:00.000Z') },
                  },
                  {
                    checkOutDate: { gte: new Date('2026-05-02T00:00:00.000Z') },
                  },
                ],
              },
            ],
          },
        }),
      );
    });

    it('ANDs stay-touch with in-house board status', async () => {
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.list({
        board: ReservationBoard['in-house'],
        from: '2026-05-02',
        to: '2026-05-28',
        page: 1,
        pageSize: 20,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { status: ReservationStatus.CHECKED_IN },
              {
                AND: [
                  {
                    checkInDate: { lte: new Date('2026-05-28T00:00:00.000Z') },
                  },
                  {
                    checkOutDate: { gte: new Date('2026-05-02T00:00:00.000Z') },
                  },
                ],
              },
            ],
          },
        }),
      );
    });

    it('rejects from without to', async () => {
      await expect(
        service.list({
          board: ReservationBoard.all,
          from: '2026-05-02',
          page: 1,
          pageSize: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects from after to', async () => {
      await expect(
        service.list({
          board: ReservationBoard.all,
          from: '2026-05-28',
          to: '2026-05-02',
          page: 1,
          pageSize: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
