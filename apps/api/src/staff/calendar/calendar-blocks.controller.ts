import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { StaffAdmin, StaffCalendarBlock } from '@cabin/api-contract';
import { CalendarService } from '../../domain/calendar/calendar.service.js';
import { CreateCalendarBlockDto } from '../../domain/calendar/dto/create-calendar-block.dto.js';
import { UpdateCalendarBlockDto } from '../../domain/calendar/dto/update-calendar-block.dto.js';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff/calendar-blocks')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class CalendarBlocksController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  create(
    @Body() dto: CreateCalendarBlockDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffCalendarBlock> {
    return this.calendarService.createBlock(dto, admin);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarBlockDto,
  ): Promise<StaffCalendarBlock> {
    return this.calendarService.updateBlock(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.calendarService.deleteBlock(id);
  }
}
