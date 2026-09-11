import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { listUnitBusyRanges } from './ical-busy.js';
import { icalExportTokenMatches } from './ical-export-token.js';
import { buildUnitIcs } from './ical-export.js';

@Injectable()
export class IcalExportService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnitIcs(unitId: string, token: string | undefined): Promise<string> {
    const provided = token?.trim() ?? '';
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId },
      select: { id: true, icalExportToken: true },
    });
    if (!icalExportTokenMatches(provided, unit?.icalExportToken) || !unit) {
      throw new NotFoundException('Calendar not found');
    }

    const ranges = await listUnitBusyRanges(this.prisma, unit.id);
    return buildUnitIcs(unit.id, ranges);
  }
}
