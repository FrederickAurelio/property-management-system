import { Module } from '@nestjs/common';
import { CalendarModule } from '../../domain/calendar/calendar.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { CalendarBlocksController } from './calendar-blocks.controller.js';
import { CalendarController } from './calendar.controller.js';

@Module({
  imports: [StaffAuthModule, CalendarModule],
  controllers: [CalendarController, CalendarBlocksController],
})
export class StaffCalendarModule {}
