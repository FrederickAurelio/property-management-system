import { Injectable, NotFoundException } from '@nestjs/common';
import {
  addDaysYmd,
  todayYmdInTimezone,
  type StaffDashboard,
} from '@cabin/api-contract';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  arrivalsWhere,
  departuresWhere,
  findOverpaidReservationIds,
  needsAttentionWhere,
  reservationListSelect,
} from '../reservations/reservation-board-where.js';
import {
  parseYmd,
  toStaffReservationListItem,
} from '../reservations/reservations-mapper.js';
import {
  assembleArrivalsSection,
  assembleDeparturesSection,
  assembleNeedsAttentionSection,
} from './dashboard-assemble.js';
import type { DashboardQueryDto } from './dto/dashboard.query.dto.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(query: DashboardQueryDto): Promise<StaffDashboard> {
    const property = await this.prisma.property.findUnique({
      where: { id: query.propertyId },
      select: { id: true, timezone: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const tz = property.timezone || 'Asia/Jakarta';
    const date = query.date ?? todayYmdInTimezone(tz);
    const todayDate = parseYmd(date);
    const tomorrow = addDaysYmd(date, 1);
    const tomorrowDate = parseYmd(tomorrow);

    const overpaidIds = await findOverpaidReservationIds(this.prisma, {
      propertyId: property.id,
    });

    const arrivalsW = arrivalsWhere(property.id, todayDate);
    const departuresW = departuresWhere(property.id, todayDate);
    const needsW = needsAttentionWhere({
      propertyId: property.id,
      todayDate,
      tomorrowDate,
      overpaidIds,
    });

    // Same pattern as desk boards: where in Prisma, full matching set for this
    // property window (no artificial take). Cap/sort to 8 happens in assemble.
    const [
      arrivalsRows,
      departuresRows,
      needsRows,
      failingFeeds,
      failingCount,
    ] = await Promise.all([
      this.prisma.reservation.findMany({
        where: arrivalsW,
        select: reservationListSelect,
      }),
      this.prisma.reservation.findMany({
        where: departuresW,
        select: reservationListSelect,
      }),
      this.prisma.reservation.findMany({
        where: needsW,
        select: reservationListSelect,
      }),
      this.prisma.unitIcalFeed.findMany({
        where: {
          isActive: true,
          lastError: { not: null },
          unit: { propertyId: property.id },
        },
        select: {
          source: true,
          lastError: true,
          unit: { select: { code: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.unitIcalFeed.count({
        where: {
          isActive: true,
          lastError: { not: null },
          unit: { propertyId: property.id },
        },
      }),
    ]);

    const arrivalsItems = arrivalsRows.map(toStaffReservationListItem);
    const departuresItems = departuresRows.map(toStaffReservationListItem);
    const needsItems = needsRows.map(toStaffReservationListItem);

    return {
      propertyId: property.id,
      date,
      propertyTimezone: tz,
      arrivals: assembleArrivalsSection(
        arrivalsItems,
        date,
        arrivalsItems.length,
      ),
      departures: assembleDeparturesSection(
        departuresItems,
        date,
        departuresItems.length,
      ),
      needsAttention: assembleNeedsAttentionSection(
        needsItems,
        { today: date, tomorrow },
        needsItems.length,
      ),
      icalFeedHealth: {
        failingCount,
        feeds: failingFeeds.map((f) => ({
          unitCode: f.unit.code,
          source: f.source,
          lastError: f.lastError ?? '',
        })),
      },
    };
  }
}
