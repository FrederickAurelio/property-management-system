import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { listUnitBusyRanges } from './ical-busy.js';
import { buildUnitIcs } from './ical-export.js';

@Injectable()
export class IcalExportService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnitIcs(unitId: string, token: string | undefined): Promise<string> {
    if (!token?.trim()) {
      throw new NotFoundException('Calendar not found');
    }

    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, icalExportToken: token.trim() },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException('Calendar not found');
    }

    const ranges = await listUnitBusyRanges(this.prisma, unit.id);
    return buildUnitIcs(unit.id, ranges);
  }
}
