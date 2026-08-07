import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentStatus, ReservationStatus } from '@cabin/api-contract';
import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('DashboardService', () => {
  const propertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const today = '2026-07-23';

  function listRow(overrides: {
    id: string;
    guestName: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmountIdr?: bigint | null;
    paidAmountIdr?: number;
    paymentStatus?: string;
  }) {
    return {
      id: overrides.id,
      guestName: overrides.guestName,
      billingPeriod: 'DAILY',
      checkInDate: new Date(`${overrides.checkInDate}T00:00:00.000Z`),
      checkOutDate: new Date(`${overrides.checkOutDate}T00:00:00.000Z`),
      status: overrides.status,
      source: 'MANUAL',
      totalAmountIdr:
        overrides.totalAmountIdr === undefined
          ? 1_000_000n
          : overrides.totalAmountIdr,
      paidAmountIdr: overrides.paidAmountIdr ?? 1_000_000,
      paymentStatus: overrides.paymentStatus ?? PaymentStatus.PAID,
      icalSyncWarning: null,
      icalOverlapHold: false,
      property: { timezone: 'Asia/Jakarta' },
      unit: { code: 'A-01' },
    };
  }

  it('assembles sections from Prisma rows', async () => {
    const arrivalRow = listRow({
      id: '11111111-1111-4111-8111-111111111101',
      guestName: 'Late Guest',
      status: ReservationStatus.CONFIRMED,
      checkInDate: '2026-07-21',
      checkOutDate: '2026-07-28',
      paidAmountIdr: 0,
      paymentStatus: PaymentStatus.UNPAID,
    });
    const departureRow = listRow({
      id: '22222222-2222-4222-8222-222222222201',
      guestName: 'Leaving',
      status: ReservationStatus.CHECKED_IN,
      checkInDate: '2026-07-20',
      checkOutDate: today,
    });
    const strandedRow = listRow({
      id: '33333333-3333-4333-8333-333333333301',
      guestName: 'No-show',
      status: ReservationStatus.CONFIRMED,
      checkInDate: '2026-07-18',
      checkOutDate: '2026-07-20',
      paidAmountIdr: 0,
      paymentStatus: PaymentStatus.UNPAID,
    });

    const prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id: propertyId,
          timezone: 'Asia/Jakarta',
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      unitIcalFeed: {
        findMany: jest.fn().mockResolvedValue([
          {
            lastError: 'HTTP 500',
            source: 'BOOKING_COM',
            unit: { code: 'A-01' },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      reservation: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([arrivalRow])
          .mockResolvedValueOnce([departureRow])
          .mockResolvedValueOnce([strandedRow]),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const service = moduleRef.get(DashboardService);
    const result = await service.getDashboard({
      propertyId,
      date: today,
    });

    expect(result.propertyId).toBe(propertyId);
    expect(result.date).toBe(today);
    expect(result.arrivals.total).toBe(1);
    expect(result.arrivals.items[0]?.guestName).toBe('Late Guest');
    expect(result.departures.total).toBe(1);
    expect(result.needsAttention.total).toBe(1);
    expect(result.needsAttention.items[0]?.attentionKinds).toContain(
      'STRANDED_CONFIRMED',
    );
    expect(result.icalFeedHealth.failingCount).toBe(1);
    expect(result.icalFeedHealth.feeds[0]).toEqual({
      unitCode: 'A-01',
      source: 'BOOKING_COM',
      lastError: 'HTTP 500',
    });
    expect(result.utilitiesDue).toEqual({ total: 0 });
    expect(prisma.reservation.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('404 when property missing', async () => {
    const prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const service = moduleRef.get(DashboardService);
    await expect(service.getDashboard({ propertyId })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
