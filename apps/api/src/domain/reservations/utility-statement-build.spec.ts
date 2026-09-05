import {
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  StayBillingPeriod,
  UtilityKind,
} from '@cabin/api-contract';
import {
  buildUtilityStatementFillInput,
  utilityStatementBillingNo,
} from './utility-statement-build.js';
import { toStaffReservation } from './reservations-mapper.js';

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

function schemeRow(
  chargeDate: string,
  electricityRateIdrPerKwh: number,
): Record<string, unknown> {
  return {
    id: `scheme_${chargeDate}`,
    reservationId: 'res_1',
    chargeDate: new Date(`${chargeDate}T00:00:00.000Z`),
    electricityRateIdrPerKwh,
    waterRateIdrPerM3: 0,
    maintenanceFeeIdrPerMonth: 0,
    electricityMinKwh: 0,
    adminFeeIdrPerMonth: 0,
    utilityAddons: [],
    createdAt: new Date('2026-08-17T10:00:00.000Z'),
    updatedAt: new Date('2026-08-17T10:00:00.000Z'),
  };
}

describe('buildUtilityStatementFillInput', () => {
  it('uses the exported month snapshot rate, not a later month', () => {
    const now = new Date('2026-08-17T10:00:00.000Z');
    const reservation = toStaffReservation(
      {
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        billingPeriod: StayBillingPeriod.MONTHLY,
        checkInDate: new Date('2026-05-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-10T00:00:00.000Z'),
        inventoryEndDate: new Date('2026-08-10T00:00:00.000Z'),
        guestName: 'Guest',
        guestEmail: null,
        guestPhone: null,
        guestCount: 2,
        notes: null,
        totalAmountIdr: BigInt(1_000_000),
        rentAmountIdr: BigInt(1_000_000),
        electricityAmountIdr: BigInt(0),
        waterAmountIdr: BigInt(0),
        maintenanceAmountIdr: BigInt(0),
        electricityRateIdrPerKwh: 1850,
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
          electricityRateIdrPerKwh: 1850,
          waterRateIdrPerM3: 0,
          maintenanceFeeIdrPerMonth: 0,
          electricityMinKwh: 0,
          adminFeeIdrPerMonth: 0,
          utilityAddons: [],
        },
        movements: [],
        utilityReadings: [
          readingRow('e0', '2026-05-10', 1000),
          readingRow('e1', '2026-06-01', 1100),
          readingRow('e2', '2026-07-01', 1200),
        ],
        maintenanceCharges: [],
        adminCharges: [],
        utilityPeriodSchemes: [
          schemeRow('2026-06-01', 1750),
          schemeRow('2026-07-01', 1850),
        ],
      } as never,
      { includeUtilities: true },
    );

    const payee = {
      bankName: 'BCA',
      accountName: 'PT CABIN',
      accountNumber: '1234567890',
    };
    const may = buildUtilityStatementFillInput(reservation, '2026-06', payee);
    const june = buildUtilityStatementFillInput(reservation, '2026-07', payee);
    expect(may.elecRate).toBe(1750);
    expect(may.elecUsageAmountIdr).toBe(Math.floor(100 * 1750));
    expect(may.bankName).toBe('BCA');
    expect(may.accountName).toBe('PT CABIN');
    expect(may.accountNumber).toBe('1234567890');
    expect(june.elecRate).toBe(1850);
    expect(june.elecUsageAmountIdr).toBe(Math.floor(100 * 1850));
  });

  it('keeps stored period schemes on wire when readings and fees are empty', () => {
    const reservation = toStaffReservation(
      {
        id: 'res_1',
        propertyId: 'prop_1',
        unitId: 'unit_1',
        unitTypeId: 'type_1',
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        billingPeriod: StayBillingPeriod.MONTHLY,
        checkInDate: new Date('2026-05-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-10T00:00:00.000Z'),
        inventoryEndDate: new Date('2026-08-10T00:00:00.000Z'),
        guestName: 'Guest',
        guestEmail: null,
        guestPhone: null,
        guestCount: 2,
        notes: null,
        totalAmountIdr: BigInt(1_000_000),
        rentAmountIdr: BigInt(1_000_000),
        electricityAmountIdr: BigInt(0),
        waterAmountIdr: BigInt(0),
        maintenanceAmountIdr: BigInt(0),
        electricityRateIdrPerKwh: 1750,
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
        icalObservedCheckInDate: null,
        icalObservedCheckOutDate: null,
        icalOverlapHold: false,
        confirmedAt: null,
        checkedInAt: null,
        checkedOutAt: null,
        cancelledAt: null,
        createdAt: new Date('2026-08-17T10:00:00.000Z'),
        updatedAt: new Date('2026-08-17T10:00:00.000Z'),
        createdByAdminId: 'admin_1',
        updatedByAdminId: 'admin_1',
        createdByAdmin: { username: 'didik' },
        updatedByAdmin: { username: 'didik' },
        property: { name: 'Skybreeze', timezone: 'Asia/Jakarta' },
        unit: { code: 'A1' },
        unitType: {
          electricityRateIdrPerKwh: 1750,
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
        utilityPeriodSchemes: [schemeRow('2026-06-01', 2000)],
      } as never,
    );

    expect(reservation.utilityPeriodSchemes).toHaveLength(1);
    expect(reservation.utilityPeriodSchemes[0]?.chargeYearMonth).toBe('2026-06');
    expect(reservation.utilityPeriodSchemes[0]?.electricityRateIdrPerKwh).toBe(
      2000,
    );
  });

  it('builds billing no from reservation id and charge month', () => {
    expect(
      utilityStatementBillingNo('cmtjh8sp-aaaa-bbbb-cccc-dddddddddddd', '2026-10'),
    ).toBe('US-CMTJH8SP-2026-10');
  });
});
