import { INVENTORY_FAR_YMD, ReservationStatus } from '@cabin/api-contract';
import { findBusyUnitIds, findStayOverlap } from './overlap.js';

describe('overlap inventory end', () => {
  const db = {
    reservation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    calendarBlock: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db.calendarBlock.findFirst.mockResolvedValue(null);
    db.calendarBlock.findMany.mockResolvedValue([]);
  });

  it('findStayOverlap queries inventoryEndDate against proposed busy end', async () => {
    db.reservation.findFirst.mockResolvedValue({
      id: 'r_monthly',
      guestName: 'Long stay',
      source: 'MANUAL',
      checkInDate: new Date('2026-05-24T00:00:00.000Z'),
      checkOutDate: new Date('2026-06-24T00:00:00.000Z'),
      inventoryEndDate: new Date(`${INVENTORY_FAR_YMD}T00:00:00.000Z`),
      status: ReservationStatus.CONFIRMED,
    });

    const hit = await findStayOverlap(db as never, {
      unitId: 'u1',
      checkInDate: '2026-07-01',
      checkOutDate: '2026-07-03',
    });

    expect(hit?.id).toBe('r_monthly');
    expect(db.reservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkInDate: { lt: expect.any(Date) },
          inventoryEndDate: { gt: expect.any(Date) },
        }),
      }),
    );
  });

  it('findBusyUnitIds uses busyEndDate FAR for monthly candidates', async () => {
    db.reservation.findMany.mockResolvedValue([{ unitId: 'u1' }]);

    const busy = await findBusyUnitIds(db as never, {
      propertyId: 'p1',
      checkInDate: '2026-05-24',
      checkOutDate: '2026-06-24',
      busyEndDate: INVENTORY_FAR_YMD,
      unitIds: ['u1', 'u2'],
    });

    expect(busy.has('u1')).toBe(true);
    expect(db.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inventoryEndDate: { gt: expect.any(Date) },
        }),
      }),
    );
    expect(db.calendarBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startDate: { lt: expect.any(Date) },
        }),
      }),
    );
  });
});
