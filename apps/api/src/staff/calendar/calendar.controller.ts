import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { StaffPropertyCalendar } from '@cabin/api-contract';
import { CalendarService } from '../../domain/calendar/calendar.service.js';
import { PropertyCalendarQueryDto } from '../../domain/calendar/dto/property-calendar.query.dto.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff/properties')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get(':propertyId/calendar')
  getPropertyCalendar(
    @Param('propertyId') propertyId: string,
    @Query() query: PropertyCalendarQueryDto,
  ): Promise<StaffPropertyCalendar> {
    return this.calendarService.getPropertyCalendar(propertyId, query);
  }
}
