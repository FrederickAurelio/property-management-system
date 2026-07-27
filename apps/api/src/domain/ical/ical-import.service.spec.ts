import { Test } from '@nestjs/testing';
import { IcalSyncWarning, ReservationStatus } from '@cabin/api-contract';
import { IcalImportService } from './ical-import.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as overlap from '../reservations/overlap.js';

const FEED = {
  id: 'feed_1',
  unitId: 'unit_1',
  source: 'AIRBNB' as const,
  importUrl: 'https://example.com/airbnb.ics',
  unit: {
    propertyId: 'prop_1',
    unitTypeId: 'type_1',
    timezone: 'Asia/Jakarta',
  },
};

const EMPTY_FEED_ERROR =
  'Feed returned 0 events (possible glitch or empty calendar)';

function icsWithUid(uid: string, summary = 'Test Guest'): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    'DTSTART;VALUE=DATE:20260728',
    'DTEND;VALUE=DATE:20260731',
    `SUMMARY:${summary}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function emptyIcs(): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join('\r\n');
}

function hrefOf(url: RequestInfo | URL): string {
  if (typeof url === 'string') return url;
  if (url instanceof URL) return url.href;
  return url.url;
}

describe('IcalImportService', () => {
  let service: IcalImportService;
  let prisma: {
    property: {
      findUnique: jest.Mock;
    };
    reservation: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    unitIcalFeed: {
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      reservation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      unitIcalFeed: {
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<void>) =>
        fn(prisma),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IcalImportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(IcalImportService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(overlap, 'findOccupyingOverlap').mockResolvedValue(null);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('sets OTA_STILL_LISTED on CANCELLED when UID returns (does not revive)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('ota-uid-1')),
    });

    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res_1',
      unitId: 'unit_1',
      status: ReservationStatus.CANCELLED,
      checkInDate: new Date('2026-07-28T00:00:00.000Z'),
      checkOutDate: new Date('2026-07-31T00:00:00.000Z'),
      icalSyncWarning: null,
      icalOtaStillListedDismissedAt: null,
      externalRef: 'ota-uid-1',
    });
    prisma.reservation.findMany
      .mockResolvedValueOnce([]) // stillListed
      .mockResolvedValueOnce([]); // missing candidates

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_1' },
      data: {
        icalSyncWarning: IcalSyncWarning.OTA_STILL_LISTED,
        icalSyncWarnedAt: expect.any(Date) as Date,
        icalObservedUnitId: null,
        icalObservedCheckInDate: null,
        icalObservedCheckOutDate: null,
      },
    });
    expect(prisma.unitIcalFeed.update).toHaveBeenCalledWith({
      where: { id: 'feed_1' },
      data: {
        lastPulledAt: expect.any(Date) as Date,
        lastSuccessAt: expect.any(Date) as Date,
        lastError: null,
      },
    });
  });

  it('does not re-set OTA_STILL_LISTED after sticky dismiss', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('ota-uid-1')),
    });

    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res_1',
      unitId: 'unit_1',
      status: ReservationStatus.CHECKED_OUT,
      checkInDate: new Date('2026-07-28T00:00:00.000Z'),
      checkOutDate: new Date('2026-07-31T00:00:00.000Z'),
      icalSyncWarning: null,
      icalOtaStillListedDismissedAt: new Date('2026-07-31T12:00:00.000Z'),
      externalRef: 'ota-uid-1',
    });
    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it('creates IMPORT_OVERLAP hold stub when new UID overlaps', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('ota-uid-new')),
    });
    jest.spyOn(overlap, 'findOccupyingOverlap').mockResolvedValue({
      type: 'stay',
      id: 'res_walkin',
      guestName: 'Walk-in',
      source: 'MANUAL',
      checkInDate: new Date('2026-07-28T00:00:00.000Z'),
      checkOutDate: new Date('2026-07-31T00:00:00.000Z'),
      status: ReservationStatus.CONFIRMED,
    });
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalRef: 'ota-uid-new',
        status: ReservationStatus.UNCONFIRMED,
        icalOverlapHold: true,
        icalSyncWarning: IcalSyncWarning.IMPORT_OVERLAP,
      }) as unknown,
    });
  });

  it('empty feed sets lastError and skips MISSING / stillListed clear', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(emptyIcs()),
    });

    await expect(service.pullFeed(FEED)).rejects.toThrow(EMPTY_FEED_ERROR);

    expect(prisma.unitIcalFeed.update).toHaveBeenCalledWith({
      where: { id: 'feed_1' },
      data: {
        lastPulledAt: expect.any(Date) as Date,
        lastError: EMPTY_FEED_ERROR,
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it('STATUS:CANCELLED-only feed succeeds and marks occupying UID MISSING', async () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:live-uid',
      'DTSTART;VALUE=DATE:20260728',
      'DTEND;VALUE=DATE:20260731',
      'SUMMARY:Guest',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(ics),
    });
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.unitIcalFeed.findUnique.mockResolvedValue({
      id: 'feed_1',
      isActive: true,
      importUrl: FEED.importUrl,
      unitId: 'unit_1',
      source: 'AIRBNB',
    });
    prisma.unitIcalFeed.findMany.mockResolvedValue([]);
    prisma.reservation.findMany
      .mockResolvedValueOnce([]) // stillListed
      .mockResolvedValueOnce([
        {
          id: 'res_live',
          externalRef: 'live-uid',
          icalSyncWarning: null,
          propertyId: 'prop_1',
          unitId: 'unit_1',
        },
      ]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.create).not.toHaveBeenCalled();
    expect(prisma.unitIcalFeed.update).toHaveBeenCalledWith({
      where: { id: 'feed_1' },
      data: {
        lastPulledAt: expect.any(Date) as Date,
        lastSuccessAt: expect.any(Date) as Date,
        lastError: null,
      },
    });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_live' },
      data: {
        icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
        icalSyncWarnedAt: expect.any(Date) as Date,
        icalObservedUnitId: null,
        icalObservedCheckInDate: null,
        icalObservedCheckOutDate: null,
      },
    });
  });

  it('block-only feed (no CANCELLED) still uses empty-feed protection', async () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:block-uid',
      'DTSTART;VALUE=DATE:20260801',
      'DTEND;VALUE=DATE:20260805',
      'SUMMARY:CLOSED - Not available',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(ics),
    });

    await expect(service.pullFeed(FEED)).rejects.toThrow(EMPTY_FEED_ERROR);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it('clears OTA_STILL_LISTED when UID leaves this unit feed', async () => {
    // Non-empty feed without the dismissed UID — empty body would abort before clear.
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('other-uid')),
    });

    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.create.mockResolvedValue({});
    prisma.reservation.findMany
      .mockResolvedValueOnce([{ id: 'res_1', externalRef: 'ota-uid-1' }])
      .mockResolvedValueOnce([]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_1' },
      data: {
        icalSyncWarning: null,
        icalSyncWarnedAt: null,
        icalOtaStillListedDismissedAt: null,
      },
    });
  });

  it('sets MISSING_FROM_FEED when UID gone from all property feeds', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('other-uid')),
    });
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.create.mockResolvedValue({});
    prisma.unitIcalFeed.findUnique.mockResolvedValue({
      id: 'feed_1',
      isActive: true,
      importUrl: FEED.importUrl,
      unitId: 'unit_1',
      source: 'AIRBNB',
    });
    prisma.unitIcalFeed.findMany.mockResolvedValue([]);

    prisma.reservation.findMany
      .mockResolvedValueOnce([]) // stillListed
      .mockResolvedValueOnce([
        {
          id: 'res_live',
          externalRef: 'live-uid',
          icalSyncWarning: null,
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
          propertyId: 'prop_1',
          unitId: 'unit_1',
        },
      ]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_live' },
      data: {
        icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
        icalSyncWarnedAt: expect.any(Date) as Date,
        icalObservedUnitId: null,
        icalObservedCheckInDate: null,
        icalObservedCheckOutDate: null,
      },
    });
  });

  it('does not set MISSING when sibling UID lookup is incomplete', async () => {
    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      const href = hrefOf(url);
      if (href.includes('sibling')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve(''),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(icsWithUid('other-uid')),
      });
    });

    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.create.mockResolvedValue({});
    prisma.unitIcalFeed.findUnique.mockResolvedValue({
      id: 'feed_1',
      isActive: true,
      importUrl: FEED.importUrl,
      unitId: 'unit_1',
      source: 'AIRBNB',
    });
    prisma.unitIcalFeed.findMany.mockResolvedValue([
      {
        id: 'feed_sibling',
        isActive: true,
        importUrl: 'https://example.com/sibling.ics',
        unitId: 'unit_2',
        source: 'AIRBNB',
      },
    ]);

    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'res_live',
          externalRef: 'live-uid',
          icalSyncWarning: null,
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
          propertyId: 'prop_1',
          unitId: 'unit_1',
        },
      ]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
        }) as unknown,
      }),
    );
  });

  it('sets UNIT_DIFFER when UID exists on sibling unit feed', async () => {
    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      const href = hrefOf(url);
      if (href.includes('sibling')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(icsWithUid('live-uid')),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(icsWithUid('other-uid')),
      });
    });

    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.create.mockResolvedValue({});
    prisma.unitIcalFeed.findUnique.mockResolvedValue({
      id: 'feed_1',
      isActive: true,
      importUrl: FEED.importUrl,
      unitId: 'unit_1',
      source: 'AIRBNB',
    });
    prisma.unitIcalFeed.findMany.mockResolvedValue([
      {
        id: 'feed_sibling',
        isActive: true,
        importUrl: 'https://example.com/sibling.ics',
        unitId: 'unit_2',
        source: 'AIRBNB',
      },
    ]);

    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'res_moved',
          externalRef: 'live-uid',
          icalSyncWarning: null,
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
          propertyId: 'prop_1',
          unitId: 'unit_1',
        },
      ]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_moved' },
      data: {
        icalSyncWarning: IcalSyncWarning.UNIT_DIFFER,
        icalSyncWarnedAt: expect.any(Date) as Date,
        icalObservedUnitId: 'unit_2',
        icalObservedCheckInDate: expect.any(Date) as Date,
        icalObservedCheckOutDate: expect.any(Date) as Date,
      },
    });
    expect(prisma.reservation.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
        }) as unknown,
      }),
    );
  });

  it('sets UNIT_DIFFER when reconciling existing row on another unit feed', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('moved-uid')),
    });

    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res_1',
      unitId: 'unit_other',
      status: ReservationStatus.CONFIRMED,
      checkInDate: new Date('2026-07-28T00:00:00.000Z'),
      checkOutDate: new Date('2026-07-31T00:00:00.000Z'),
      icalSyncWarning: null,
      icalSyncWarnedAt: null,
      icalOtaStillListedDismissedAt: null,
      icalObservedUnitId: null,
      externalRef: 'moved-uid',
    });
    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_1' },
      data: expect.objectContaining({
        icalSyncWarning: IcalSyncWarning.UNIT_DIFFER,
        icalObservedUnit: { connect: { id: 'unit_1' } },
        icalObservedCheckInDate: expect.any(Date) as Date,
        icalObservedCheckOutDate: expect.any(Date) as Date,
      }) as unknown,
    });
  });

  it('sets DATES_DIFFER on CONFIRMED and does not clear it when UID stays on feed', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            'UID:maria-uid',
            'DTSTART;VALUE=DATE:20260816',
            'DTEND;VALUE=DATE:20260819',
            'SUMMARY:Maria Santos',
            'END:VEVENT',
            'END:VCALENDAR',
          ].join('\r\n'),
        ),
    });

    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res_maria',
      unitId: 'unit_1',
      status: ReservationStatus.CONFIRMED,
      checkInDate: new Date('2026-08-15T00:00:00.000Z'),
      checkOutDate: new Date('2026-08-18T00:00:00.000Z'),
      icalSyncWarning: null,
      icalSyncWarnedAt: null,
      icalOtaStillListedDismissedAt: null,
      icalObservedUnitId: null,
      icalObservedCheckInDate: null,
      icalObservedCheckOutDate: null,
      externalRef: 'maria-uid',
    });

    // applyMissing re-reads the row after reconcile set DATES_DIFFER + observed dates
    prisma.reservation.findMany
      .mockResolvedValueOnce([]) // stillListed
      .mockResolvedValueOnce([
        {
          id: 'res_maria',
          externalRef: 'maria-uid',
          icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
          icalObservedUnitId: null,
          icalObservedCheckInDate: new Date('2026-08-16T00:00:00.000Z'),
          icalObservedCheckOutDate: new Date('2026-08-19T00:00:00.000Z'),
          propertyId: 'prop_1',
          unitId: 'unit_1',
        },
      ]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_maria' },
      data: expect.objectContaining({
        icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
        icalObservedCheckInDate: expect.any(Date) as Date,
        icalObservedCheckOutDate: expect.any(Date) as Date,
      }) as unknown,
    });

    // Must not wipe DATES_DIFFER in the post-tx MISSING pass
    expect(prisma.reservation.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res_maria' },
        data: expect.objectContaining({
          icalSyncWarning: null,
        }) as unknown,
      }),
    );
  });

  it('skips CANCELLED and block-like SUMMARY VEVENTs', async () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:cancelled-uid',
      'DTSTART;VALUE=DATE:20260728',
      'DTEND;VALUE=DATE:20260731',
      'SUMMARY:Guest',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:block-uid',
      'DTSTART;VALUE=DATE:20260801',
      'DTEND;VALUE=DATE:20260805',
      'SUMMARY:CLOSED - Not available',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:real-uid',
      'DTSTART;VALUE=DATE:20260810',
      'DTEND;VALUE=DATE:20260812',
      'SUMMARY:Reserved',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(ics),
    });
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.create.mockResolvedValue({});
    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.create).toHaveBeenCalledTimes(1);
    expect(prisma.reservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalRef: 'real-uid',
      }) as unknown,
    });
  });

  it('DATE-TIME uses property timezone for stay YMD', async () => {
    // 2026-07-27 17:00 UTC = 2026-07-28 00:00 Asia/Jakarta
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:timed-uid',
      'DTSTART:20260727T170000Z',
      'DTEND:20260730T170000Z',
      'SUMMARY:Timed Guest',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(ics),
    });
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.create.mockResolvedValue({});
    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalRef: 'timed-uid',
        checkInDate: new Date('2026-07-28T00:00:00.000Z'),
        checkOutDate: new Date('2026-07-31T00:00:00.000Z'),
      }) as unknown,
    });
  });

  it('unique-race on create reconciles existing row', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('race-uid')),
    });
    prisma.reservation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'res_raced',
        unitId: 'unit_1',
        status: ReservationStatus.UNCONFIRMED,
        checkInDate: new Date('2026-07-28T00:00:00.000Z'),
        checkOutDate: new Date('2026-07-30T00:00:00.000Z'),
        icalSyncWarning: null,
        icalSyncWarnedAt: null,
        icalOtaStillListedDismissedAt: null,
        externalRef: 'race-uid',
      });
    prisma.reservation.create.mockRejectedValue(
      new Error('Unique constraint failed'),
    );
    prisma.reservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.pullFeed(FEED);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_raced' },
      data: expect.objectContaining({
        checkInDate: new Date('2026-07-28T00:00:00.000Z'),
        checkOutDate: new Date('2026-07-31T00:00:00.000Z'),
      }) as unknown,
    });
    expect(prisma.unitIcalFeed.update).toHaveBeenCalledWith({
      where: { id: 'feed_1' },
      data: expect.objectContaining({
        lastSuccessAt: expect.any(Date) as Date,
        lastError: null,
      }) as unknown,
    });
  });

  it('unrecovered create failure fails the pull (no silent success)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(icsWithUid('bad-uid')),
    });
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.create.mockRejectedValue(new Error('DB down'));
    prisma.reservation.findMany.mockResolvedValue([]);

    await expect(service.pullFeed(FEED)).rejects.toThrow(/Insert failed/);

    expect(prisma.unitIcalFeed.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastSuccessAt: expect.any(Date) as Date,
          lastError: null,
        }) as unknown,
      }),
    );
  });

  it('fetchEventDatesForUid falls through to sibling feed when preferred misses', async () => {
    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      const href = hrefOf(url);
      if (href.includes('sibling')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(icsWithUid('abc')),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(emptyIcs()),
      });
    });

    prisma.unitIcalFeed.findUnique.mockResolvedValue({
      id: 'feed_mawar',
      isActive: true,
      importUrl: 'https://example.com/mawar.ics',
      unitId: 'unit_mawar',
      source: 'AIRBNB',
    });
    prisma.unitIcalFeed.findMany.mockResolvedValue([
      {
        id: 'feed_melati',
        isActive: true,
        importUrl: 'https://example.com/sibling-melati.ics',
        unitId: 'unit_melati',
        source: 'AIRBNB',
      },
    ]);

    const dates = await service.fetchEventDatesForUid({
      unitId: 'unit_mawar',
      propertyId: 'prop_1',
      source: 'AIRBNB',
      externalRef: 'abc',
    });

    expect(dates.kind).toBe('found');
    if (dates.kind === 'found') {
      expect(dates.checkOutDate > dates.checkInDate).toBe(true);
      expect(dates.unitId).toBe('unit_melati');
    }
  });
});
