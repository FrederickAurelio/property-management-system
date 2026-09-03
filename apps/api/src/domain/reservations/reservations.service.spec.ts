import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiErrorCode,
  ApiFieldReason,
  ArchiveKind,
  CancelDisposition,
  IcalSyncWarning,
  PaymentMovementDirection,
  PaymentMovementKind,
  PaymentStatus,
  PAYMENT_MOVEMENT_UNDO_WINDOW_MS,
  ReservationBoard,
  ReservationListSort,
  ReservationSource,
  ReservationStatus,
  StayBillingPeriod,
  UnitStatus,
  UtilityAddonKind,
  UtilityKind,
  canUndoPaymentMovement,
  latestPaymentMovementId,
  paymentMovementUndoRemainingMs,
  recomputePaymentStatus,
  sumPaidFromMovements,
  signedAmountFor,
  todayYmdInTimezone,
} from '@cabin/api-contract';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IcalImportService } from '../ical/ical-import.service';
import { PDF_CONVERT } from '../../integrations/pdf-convert/pdf-convert.port';

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

  it('canUndoPaymentMovement is latest within the window only', () => {
    const createdAt = '2026-08-17T10:00:00.000Z';
    const now = new Date('2026-08-17T10:04:00.000Z');
    expect(
      canUndoPaymentMovement({
        movementId: 'm1',
        createdAt,
        latestId: 'm1',
        reservationStatus: ReservationStatus.CONFIRMED,
        now,
      }),
    ).toBe(true);
    expect(
      canUndoPaymentMovement({
        movementId: 'm1',
        createdAt,
        latestId: 'm2',
        reservationStatus: ReservationStatus.CONFIRMED,
        now,
      }),
    ).toBe(false);
    expect(
      canUndoPaymentMovement({
        movementId: 'm1',
        createdAt,
        latestId: 'm1',
        reservationStatus: ReservationStatus.CANCELLED,
        now,
      }),
    ).toBe(false);
    expect(
      canUndoPaymentMovement({
        movementId: 'm1',
        createdAt,
        latestId: 'm1',
        reservationStatus: ReservationStatus.CONFIRMED,
        now: new Date('2026-08-17T10:05:01.000Z'),
      }),
    ).toBe(false);
    expect(paymentMovementUndoRemainingMs(createdAt, now)).toBe(
      PAYMENT_MOVEMENT_UNDO_WINDOW_MS - 4 * 60 * 1000,
    );
    expect(
      latestPaymentMovementId([
        { id: 'older', createdAt: '2026-08-17T09:00:00.000Z' },
        { id: 'newer', createdAt: '2026-08-17T10:00:00.000Z' },
      ]),
    ).toBe('newer');
  });
});

const SAMPLE_PROOF = {
  kind: ArchiveKind.IMAGE,
  id: 'arch_1',
  url: 'http://127.0.0.1:3910/archive/2026/arch_1',
  name: 'bca.webp',
  mimeType: 'image/webp',
  byteSize: 80_000,
};

function staffDetailRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-17T10:00:00.000Z');
  return {
    id: 'res_1',
    propertyId: 'prop_1',
    unitId: 'unit_1',
    unitTypeId: 'type_1',
    source: ReservationSource.MANUAL,
    status: ReservationStatus.CONFIRMED,
    billingPeriod: StayBillingPeriod.DAILY,
    checkInDate: new Date('2026-08-17T00:00:00.000Z'),
    checkOutDate: new Date('2026-08-20T00:00:00.000Z'),
    guestName: 'Guest',
    guestEmail: 'a@b.com',
    guestPhone: null,
    guestCount: 2,
    notes: null,
    totalAmountIdr: BigInt(1_000_000),
    rentAmountIdr: BigInt(1_000_000),
    electricityAmountIdr: BigInt(0),
    waterAmountIdr: BigInt(0),
    maintenanceAmountIdr: BigInt(0),
    electricityRateIdrPerKwh: 0,
    waterRateIdrPerM3: 0,
    maintenanceFeeIdrPerMonth: 0,
    electricityMinKwh: 0,
    adminFeeIdrPerMonth: 0,
    utilityAddons: [],
    adminAmountIdr: BigInt(0),
    paidAmountIdr: BigInt(0),
    paymentStatus: PaymentStatus.UNPAID,
    collectedVia: null,
    externalRef: null,
    icalSyncWarning: null,
    icalSyncWarnedAt: null,
    icalObservedUnitId: null,
    icalObservedUnit: null,
    icalObservedCheckInDate: null,
    icalObservedCheckOutDate: null,
    icalOverlapHold: false,
    confirmedAt: now,
    checkedInAt: null,
    checkedOutAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    createdByAdminId: 'admin_1',
    updatedByAdminId: 'admin_1',
    createdByAdmin: { username: 'didik' },
    updatedByAdmin: { username: 'didik' },
    property: { name: 'Skybreeze', timezone: 'Asia/Jakarta' },
    unit: { code: 'A1' },
    unitType: {
      electricityRateIdrPerKwh: 0,
      waterRateIdrPerM3: 0,
      maintenanceFeeIdrPerMonth: 0,
      electricityMinKwh: 0,
      adminFeeIdrPerMonth: 0,
      utilityAddons: [],
    },
    movements: [],
    utilityReadings: [],
    maintenanceCharges: [],
    adminCharges: [],
    utilityPeriodSchemes: [],
    ...overrides,
  };
}

describe('ReservationsService', () => {
  let service: ReservationsService;
  let icalImport: {
    fetchEventDatesForUid: jest.Mock;
    syncAll: jest.Mock;
  };
  let pdfConvert: {
    convertXlsxToPdf: jest.Mock;
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
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    calendarBlock: { findFirst: jest.Mock };
    unit: { findUnique: jest.Mock };
    unitType: { findUnique: jest.Mock };
    property: { findUnique: jest.Mock };
    reservationUtilityReading: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    reservationMaintenanceCharge: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    reservationAdminCharge: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    reservationUtilityPeriodScheme: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    utilityStatementBankAccount: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
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
      electricityRateIdrPerKwh: 0,
      waterRateIdrPerM3: 0,
      maintenanceFeeIdrPerMonth: 0,
      electricityMinKwh: 0,
      adminFeeIdrPerMonth: 0,
      utilityAddons: [],
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
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      calendarBlock: { findFirst: jest.fn().mockResolvedValue(null) },
      unit: { findUnique: jest.fn() },
      unitType: { findUnique: jest.fn() },
      property: { findUnique: jest.fn() },
      reservationUtilityReading: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      reservationMaintenanceCharge: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      reservationAdminCharge: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      reservationUtilityPeriodScheme: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      utilityStatementBankAccount: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    icalImport = {
      fetchEventDatesForUid: jest.fn(),
      syncAll: jest.fn(),
    };
    pdfConvert = {
      convertXlsxToPdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: IcalImportService,
          useValue: icalImport,
        },
        { provide: PDF_CONVERT, useValue: pdfConvert },
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
            rentAmountIdr: 1_000_000,
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
            rentAmountIdr: 16_900_000,
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
            rentAmountIdr: 1_000_000,
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
            rentAmountIdr: 1_000_000,
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

    it('snapshots unit-type min kWh, admin fee, and add-ons on create', async () => {
      const addons = [
        {
          utility: UtilityKind.ELECTRICITY,
          name: 'PJU',
          kind: UtilityAddonKind.PERCENT,
          value: 10,
          sortOrder: 0,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          name: 'Admin PLN',
          kind: UtilityAddonKind.CONSTANT,
          value: 5_000,
          sortOrder: 1,
        },
      ];
      prisma.unit.findUnique.mockResolvedValue({
        ...unitBookable,
        unitType: {
          ...unitBookable.unitType,
          electricityRateIdrPerKwh: 1700,
          electricityMinKwh: 52,
          adminFeeIdrPerMonth: 6_500,
          utilityAddons: addons,
        },
      });
      prisma.reservation.create.mockResolvedValue({ id: 'res_new' });
      prisma.reservation.findUnique.mockResolvedValue(
        staffDetailRow({ id: 'res_new' }),
      );
      prisma.reservation.findUniqueOrThrow.mockResolvedValue({
        totalAmountIdr: BigInt(1_000_000),
      });

      await service.create(
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
          guestCount: 2,
          rentAmountIdr: 1_000_000,
          depositAmountIdr: 0,
        },
        actor,
      );

      expect(prisma.reservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          electricityRateIdrPerKwh: 1700,
          electricityMinKwh: 52,
          adminFeeIdrPerMonth: 6_500,
          utilityAddons: addons,
          adminAmountIdr: BigInt(0),
        }) as Record<string, unknown>,
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
        rentAmountIdr: BigInt(1_000_000),
        electricityAmountIdr: BigInt(0),
        waterAmountIdr: BigInt(0),
        maintenanceAmountIdr: BigInt(0),
        electricityRateIdrPerKwh: 0,
        waterRateIdrPerM3: 0,
        maintenanceFeeIdrPerMonth: 0,
        electricityMinKwh: 0,
        adminFeeIdrPerMonth: 0,
        utilityAddons: [],
        adminAmountIdr: BigInt(0),
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
    it('allows IN over Due (held as credit)', async () => {
      prisma.reservation.findUnique.mockResolvedValue(
        staffDetailRow({
          paidAmountIdr: BigInt(800_000),
          movements: [],
        }),
      );
      prisma.reservation.findUniqueOrThrow.mockResolvedValue({
        totalAmountIdr: BigInt(1_000_000),
      });
      prisma.$queryRaw.mockResolvedValue([
        { id: 'res_1', status: ReservationStatus.CONFIRMED },
      ]);
      prisma.paymentMovement.create.mockResolvedValue({ id: 'mov_1' });
      prisma.paymentMovement.findMany.mockResolvedValue([
        { signedAmount: BigInt(1_100_000), method: null },
      ]);

      await service.postMovement(
        'res_1',
        {
          direction: PaymentMovementDirection.IN,
          kind: PaymentMovementKind.TOP_UP,
          amountIdr: 300_000,
        },
        actor,
      );

      expect(prisma.paymentMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountIdr: BigInt(300_000),
            direction: PaymentMovementDirection.IN,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('persists proofImages and defaults to empty', async () => {
      const proofs = [SAMPLE_PROOF];
      prisma.reservation.findUnique.mockResolvedValue(
        staffDetailRow({
          paidAmountIdr: BigInt(0),
          movements: [],
        }),
      );
      prisma.reservation.findUniqueOrThrow.mockResolvedValue({
        totalAmountIdr: BigInt(1_000_000),
      });
      prisma.$queryRaw.mockResolvedValue([
        { id: 'res_1', status: ReservationStatus.CONFIRMED },
      ]);
      prisma.paymentMovement.create.mockResolvedValue({ id: 'mov_1' });
      prisma.paymentMovement.findMany.mockResolvedValue([
        { signedAmount: BigInt(200_000), method: null },
      ]);

      await service.postMovement(
        'res_1',
        {
          direction: PaymentMovementDirection.IN,
          kind: PaymentMovementKind.DEPOSIT,
          amountIdr: 200_000,
          proofImages: proofs,
        },
        actor,
      );

      expect(prisma.paymentMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountIdr: BigInt(200_000),
            proofImages: proofs,
          }) as Record<string, unknown>,
        }),
      );

      prisma.paymentMovement.create.mockClear();
      await service.postMovement(
        'res_1',
        {
          direction: PaymentMovementDirection.IN,
          kind: PaymentMovementKind.DEPOSIT,
          amountIdr: 200_000,
        },
        actor,
      );
      expect(prisma.paymentMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proofImages: [],
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('patchMovementProofs', () => {
    it('replace-sets proofImages without touching Paid', async () => {
      prisma.reservation.findUnique.mockResolvedValue(
        staffDetailRow({ paidAmountIdr: BigInt(200_000) }),
      );
      prisma.paymentMovement.findFirst.mockResolvedValue({ id: 'mov_1' });
      prisma.paymentMovement.update.mockResolvedValue({ id: 'mov_1' });

      await service.patchMovementProofs('res_1', 'mov_1', {
        proofImages: [SAMPLE_PROOF],
      });

      expect(prisma.paymentMovement.update).toHaveBeenCalledWith({
        where: { id: 'mov_1' },
        data: { proofImages: [SAMPLE_PROOF] },
      });
      expect(prisma.reservation.update).not.toHaveBeenCalled();

      await service.patchMovementProofs('res_1', 'mov_1', { proofImages: [] });
      expect(prisma.paymentMovement.update).toHaveBeenLastCalledWith({
        where: { id: 'mov_1' },
        data: { proofImages: [] },
      });
    });

    it('404 when movement is on another reservation', async () => {
      prisma.reservation.findUnique.mockResolvedValue(staffDetailRow());
      prisma.paymentMovement.findFirst.mockResolvedValue(null);

      await expect(
        service.patchMovementProofs('res_1', 'mov_other', { proofImages: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('undoMovement', () => {
    const freshMovement = {
      id: 'mov_1',
      reservationId: 'res_1',
      createdAt: new Date(),
    };

    it('deletes the latest movement within the window and re-sums Paid', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'res_1', status: ReservationStatus.CONFIRMED },
      ]);
      prisma.reservation.findUnique.mockResolvedValue(staffDetailRow());
      prisma.paymentMovement.findFirst
        .mockResolvedValueOnce(freshMovement)
        .mockResolvedValueOnce({ id: 'mov_1' });
      prisma.paymentMovement.delete.mockResolvedValue(freshMovement);
      prisma.paymentMovement.findMany.mockResolvedValue([]);
      prisma.reservation.findUniqueOrThrow.mockResolvedValue({
        totalAmountIdr: BigInt(1_000_000),
      });

      await service.undoMovement('res_1', 'mov_1', actor);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.paymentMovement.delete).toHaveBeenCalledWith({
        where: { id: 'mov_1' },
      });
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res_1' },
          data: expect.objectContaining({
            paidAmountIdr: BigInt(0),
          }) as Record<string, unknown>,
        }),
      );
    });

    it('rejects expired, not-latest, and cancelled', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'res_1', status: ReservationStatus.CANCELLED },
      ]);
      prisma.paymentMovement.findFirst
        .mockResolvedValueOnce(freshMovement)
        .mockResolvedValueOnce({ id: 'mov_1' });

      await expect(
        service.undoMovement('res_1', 'mov_1', actor),
      ).rejects.toMatchObject({
        response: {
          details: { reason: ApiFieldReason.INVALID_STATUS_TRANSITION },
        },
      });
      expect(prisma.paymentMovement.delete).not.toHaveBeenCalled();

      prisma.$queryRaw.mockResolvedValue([
        { id: 'res_1', status: ReservationStatus.CONFIRMED },
      ]);
      prisma.paymentMovement.findFirst
        .mockResolvedValueOnce(freshMovement)
        .mockResolvedValueOnce({ id: 'mov_newer' });

      await expect(
        service.undoMovement('res_1', 'mov_1', actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.paymentMovement.delete).not.toHaveBeenCalled();

      const expired = {
        ...freshMovement,
        createdAt: new Date(
          Date.now() - PAYMENT_MOVEMENT_UNDO_WINDOW_MS - 1000,
        ),
      };
      prisma.paymentMovement.findFirst
        .mockResolvedValueOnce(expired)
        .mockResolvedValueOnce({ id: 'mov_1' });

      await expect(
        service.undoMovement('res_1', 'mov_1', actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.paymentMovement.delete).not.toHaveBeenCalled();
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

    it('applies from-only as checkOutDate ≥ from', async () => {
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.list({
        board: ReservationBoard.all,
        from: '2026-05-02',
        page: 1,
        pageSize: 20,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {},
              {
                checkOutDate: { gte: new Date('2026-05-02T00:00:00.000Z') },
              },
            ],
          },
        }),
      );
    });

    it('rejects to without from', async () => {
      await expect(
        service.list({
          board: ReservationBoard.all,
          to: '2026-05-28',
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

    it('filters by billingPeriod', async () => {
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.list({
        board: ReservationBoard.all,
        billingPeriod: StayBillingPeriod.MONTHLY,
        page: 1,
        pageSize: 20,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { billingPeriod: StayBillingPeriod.MONTHLY },
        }),
      );
    });
  });

  describe('list sort=openAmount', () => {
    it('orders page ids by open amount then hydrates list select', async () => {
      const listRow = (id: string) => ({
        id,
        guestName: id,
        billingPeriod: StayBillingPeriod.DAILY,
        checkInDate: new Date('2026-08-01T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-03T00:00:00.000Z'),
        status: ReservationStatus.CONFIRMED,
        source: ReservationSource.MANUAL,
        totalAmountIdr: 1_000_000n,
        paidAmountIdr: 0n,
        paymentStatus: PaymentStatus.UNPAID,
        icalSyncWarning: null,
        icalOverlapHold: false,
        property: { timezone: 'Asia/Jakarta' },
        unit: { code: 'A1' },
      });

      prisma.reservation.count.mockResolvedValue(2);
      prisma.reservation.findMany
        .mockResolvedValueOnce([{ id: 'r_small' }, { id: 'r_big' }])
        .mockResolvedValueOnce([listRow('r_big'), listRow('r_small')]);
      prisma.$queryRaw.mockResolvedValue([{ id: 'r_big' }, { id: 'r_small' }]);

      const result = await service.list({
        board: ReservationBoard.all,
        sort: ReservationListSort.openAmount,
        propertyId: 'prop_1',
        page: 1,
        pageSize: 20,
      });

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.items.map((row) => row.id)).toEqual(['r_big', 'r_small']);
      expect(result.pageInfo.total).toBe(2);
    });

    it('returns empty items when no matching ids', async () => {
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.findMany.mockResolvedValueOnce([]);

      const result = await service.list({
        sort: ReservationListSort.openAmount,
        page: 1,
        pageSize: 20,
      });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.pageInfo.total).toBe(0);
    });
  });

  describe('putUtilities', () => {
    const elecAddons = [
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'PJU',
        kind: UtilityAddonKind.PERCENT,
        value: 10,
        sortOrder: 0,
      },
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'Admin PLN',
        kind: UtilityAddonKind.CONSTANT,
        value: 5_000,
        sortOrder: 1,
      },
    ];

    function mockPutRoundTrip(existing: Record<string, unknown>) {
      prisma.reservation.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(staffDetailRow(existing));
      prisma.reservation.findUniqueOrThrow.mockResolvedValue({
        totalAmountIdr: BigInt(1_000_000),
      });
    }

    it('bills min kWh + add-ons per interval without rewriting meters', async () => {
      mockPutRoundTrip(
        staffDetailRow({
          electricityRateIdrPerKwh: 1700,
          electricityMinKwh: 52,
          utilityAddons: elecAddons,
          rentAmountIdr: BigInt(1_000_000),
          totalAmountIdr: BigInt(1_000_000),
        }),
      );

      await service.putUtilities(
        'res_1',
        {
          electricityReadings: [
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-05-10',
              meterValue: 1000,
            },
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-06-01',
              meterValue: 1023,
            },
          ],
          waterReadings: [],
          maintenanceCharges: [],
          adminCharges: [],
        },
        actor,
      );

      const usageRp = Math.floor(52 * 1700);
      const kindTotal = usageRp + Math.floor((usageRp * 10) / 100) + 5_000;
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res_1' },
          data: expect.objectContaining({
            electricityAmountIdr: BigInt(kindTotal),
            adminAmountIdr: BigInt(0),
            totalAmountIdr: BigInt(1_000_000 + kindTotal),
            utilityAddons: elecAddons,
          }) as Record<string, unknown>,
        }),
      );
      expect(prisma.reservationUtilityReading.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ meterValue: 1000 }),
          expect.objectContaining({ meterValue: 1023 }),
        ]) as unknown[],
      });
    });

    it('copies unit-type scheme on first PUT when snapshot add-ons are empty', async () => {
      mockPutRoundTrip(
        staffDetailRow({
          electricityRateIdrPerKwh: 1700,
          electricityMinKwh: 0,
          adminFeeIdrPerMonth: 0,
          utilityAddons: [],
        }),
      );
      prisma.unitType.findUnique.mockResolvedValue({
        electricityMinKwh: 52,
        adminFeeIdrPerMonth: 6_500,
        utilityAddons: elecAddons,
      });

      await service.putUtilities(
        'res_1',
        {
          electricityReadings: [],
          waterReadings: [],
          maintenanceCharges: [],
          adminCharges: [{ chargeDate: '2026-06-01', amountIdr: 6_500 }],
        },
        actor,
      );

      expect(prisma.unitType.findUnique).toHaveBeenCalled();
      expect(prisma.reservationAdminCharge.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            amountIdr: BigInt(6_500),
          }),
        ],
      });
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            electricityMinKwh: 52,
            adminFeeIdrPerMonth: 6_500,
            utilityAddons: elecAddons,
            adminAmountIdr: BigInt(6_500),
            totalAmountIdr: BigInt(1_000_000 + 6_500),
          }) as Record<string, unknown>,
        }),
      );
    });

    it('bills each month with its own frozen kWh rate', async () => {
      mockPutRoundTrip(
        staffDetailRow({
          electricityRateIdrPerKwh: 1750,
          electricityMinKwh: 0,
          utilityAddons: [],
          rentAmountIdr: BigInt(1_000_000),
          totalAmountIdr: BigInt(1_000_000),
        }),
      );

      await service.putUtilities(
        'res_1',
        {
          electricityReadings: [
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-05-10',
              meterValue: 1000,
            },
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-06-01',
              meterValue: 1100,
            },
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-07-01',
              meterValue: 1200,
            },
          ],
          waterReadings: [],
          maintenanceCharges: [],
          adminCharges: [],
          periodSchemes: [
            {
              chargeYearMonth: '2026-06',
              electricityRateIdrPerKwh: 1750,
              waterRateIdrPerM3: 0,
              maintenanceFeeIdrPerMonth: 0,
              electricityMinKwh: 0,
              adminFeeIdrPerMonth: 0,
              utilityAddons: [],
            },
            {
              chargeYearMonth: '2026-07',
              electricityRateIdrPerKwh: 1850,
              waterRateIdrPerM3: 0,
              maintenanceFeeIdrPerMonth: 0,
              electricityMinKwh: 0,
              adminFeeIdrPerMonth: 0,
              utilityAddons: [],
            },
          ],
        },
        actor,
      );

      const mayRp = Math.floor(100 * 1750);
      const juneRp = Math.floor(100 * 1850);
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            electricityAmountIdr: BigInt(mayRp + juneRp),
            electricityRateIdrPerKwh: 1850,
          }) as Record<string, unknown>,
        }),
      );
      expect(
        prisma.reservationUtilityPeriodScheme.createMany,
      ).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ electricityRateIdrPerKwh: 1750 }),
          expect.objectContaining({ electricityRateIdrPerKwh: 1850 }),
        ]) as unknown[],
      });
    });
  });

  describe('getUtilityStatementPdf', () => {
    const statementPayee = {
      bankName: 'BCA',
      accountName: 'PT CABIN',
      accountNumber: '1234567890',
    };
    const elecAddons = [
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'PJU',
        kind: UtilityAddonKind.PERCENT,
        value: 10,
        sortOrder: 0,
      },
      {
        utility: UtilityKind.ELECTRICITY,
        name: 'Admin PLN',
        kind: UtilityAddonKind.CONSTANT,
        value: 5_000,
        sortOrder: 1,
      },
    ];

    function readingRow(id: string, readingDate: string, meterValue: number) {
      return {
        id,
        reservationId: 'res_1',
        utility: UtilityKind.ELECTRICITY,
        readingDate: new Date(`${readingDate}T00:00:00.000Z`),
        meterValue,
        proofImages: [],
        createdAt: new Date('2026-08-17T10:00:00.000Z'),
        createdByAdminId: 'admin_1',
      };
    }

    it('converts a filled statement and returns PDF bytes', async () => {
      prisma.reservation.findUnique.mockResolvedValue(
        staffDetailRow({
          electricityRateIdrPerKwh: 1700,
          electricityMinKwh: 52,
          utilityAddons: elecAddons,
          paidAmountIdr: BigInt(200_000),
          totalAmountIdr: BigInt(1_000_000),
          utilityReadings: [
            readingRow('e0', '2026-05-10', 1000),
            readingRow('e1', '2026-06-01', 1023),
          ],
        }),
      );
      const pdf = Buffer.from('%PDF-1.4 test');
      pdfConvert.convertXlsxToPdf.mockResolvedValue(pdf);

      const result = await service.getUtilityStatementPdf(
        'res_1',
        '2026-06',
        statementPayee,
      );

      expect(result.filename).toBe('utility-statement-A1-2026-06.pdf');
      expect(result.pdf.equals(pdf)).toBe(true);
      expect(pdfConvert.convertXlsxToPdf).toHaveBeenCalledWith(
        expect.any(Buffer),
      );
    });

    it('returns 400 when the month has no billed interval', async () => {
      prisma.reservation.findUnique.mockResolvedValue(staffDetailRow());

      await expect(
        service.getUtilityStatementPdf('res_1', '2026-06', statementPayee),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(pdfConvert.convertXlsxToPdf).not.toHaveBeenCalled();
    });

    it('surfaces Gotenberg failure as 503 PDF_UNAVAILABLE', async () => {
      prisma.reservation.findUnique.mockResolvedValue(
        staffDetailRow({
          electricityRateIdrPerKwh: 1700,
          electricityMinKwh: 52,
          utilityAddons: elecAddons,
          utilityReadings: [
            readingRow('e0', '2026-05-10', 1000),
            readingRow('e1', '2026-06-01', 1023),
          ],
        }),
      );
      pdfConvert.convertXlsxToPdf.mockRejectedValue(
        new ServiceUnavailableException({
          message: 'PDF export is unavailable.',
          code: ApiErrorCode.PDF_UNAVAILABLE,
        }),
      );

      await expect(
        service.getUtilityStatementPdf('res_1', '2026-06', statementPayee),
      ).rejects.toMatchObject({
        response: { code: ApiErrorCode.PDF_UNAVAILABLE },
      });
    });
  });

  describe('utility-statement bank accounts', () => {
    const payee = {
      bankName: 'BCA',
      accountName: 'PT CABIN',
      accountNumber: '1234567890',
    };

    it('lists the five most recent accounts', async () => {
      prisma.utilityStatementBankAccount.findMany.mockResolvedValue([
        {
          id: 'acc_1',
          bankName: payee.bankName,
          accountName: payee.accountName,
          accountNumber: payee.accountNumber,
          lastUsedAt: new Date('2026-09-02T00:00:00.000Z'),
        },
      ]);

      const rows = await service.listUtilityStatementBankAccounts();

      expect(prisma.utilityStatementBankAccount.findMany).toHaveBeenCalledWith({
        orderBy: { lastUsedAt: 'desc' },
        take: 5,
      });
      expect(rows).toEqual([
        {
          id: 'acc_1',
          ...payee,
          lastUsedAt: '2026-09-02T00:00:00.000Z',
        },
      ]);
    });

    it('upserts then drops accounts beyond five', async () => {
      prisma.utilityStatementBankAccount.upsert.mockResolvedValue({});
      prisma.utilityStatementBankAccount.findMany
        .mockResolvedValueOnce([{ id: 'acc_old' }])
        .mockResolvedValueOnce([
          {
            id: 'acc_1',
            bankName: payee.bankName,
            accountName: payee.accountName,
            accountNumber: payee.accountNumber,
            lastUsedAt: new Date('2026-09-02T00:00:00.000Z'),
          },
        ]);
      prisma.utilityStatementBankAccount.deleteMany.mockResolvedValue({
        count: 1,
      });

      const rows = await service.saveUtilityStatementBankAccount(payee);

      expect(prisma.utilityStatementBankAccount.upsert).toHaveBeenCalledWith({
        where: {
          bankName_accountName_accountNumber: payee,
        },
        create: payee,
        update: { lastUsedAt: expect.any(Date) as Date },
      });
      expect(
        prisma.utilityStatementBankAccount.deleteMany,
      ).toHaveBeenCalledWith({
        where: { id: { in: ['acc_old'] } },
      });
      expect(rows).toHaveLength(1);
    });
  });
});
