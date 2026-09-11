import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as icalBusy from './ical-busy.js';
import { IcalExportService } from './ical-export.service.js';

describe('IcalExportService', () => {
  let service: IcalExportService;
  let prisma: { unit: { findFirst: jest.Mock } };
  const storedToken = 'a'.repeat(48);

  beforeEach(async () => {
    prisma = {
      unit: { findFirst: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        IcalExportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(IcalExportService);
    jest.spyOn(icalBusy, 'listUnitBusyRanges').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns ICS when the token matches', async () => {
    prisma.unit.findFirst.mockResolvedValue({
      id: 'unit_1',
      icalExportToken: storedToken,
    });

    const ics = await service.getUnitIcs('unit_1', storedToken);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(icalBusy.listUnitBusyRanges).toHaveBeenCalled();
  });

  it('returns the same 404 for a missing unit and a wrong token', async () => {
    prisma.unit.findFirst.mockResolvedValue(null);
    await expect(
      service.getUnitIcs('unit_1', storedToken),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.unit.findFirst.mockResolvedValue({
      id: 'unit_1',
      icalExportToken: storedToken,
    });
    await expect(
      service.getUnitIcs('unit_1', 'b'.repeat(48)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getUnitIcs('unit_1', undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
