import { Module } from '@nestjs/common';
import { IcalDomainModule } from '../../domain/ical/ical.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { StaffIcalController } from './ical.controller.js';
import { IcalSyncScheduler } from './ical-sync.scheduler.js';

@Module({
  imports: [StaffAuthModule, IcalDomainModule],
  controllers: [StaffIcalController],
  providers: [IcalSyncScheduler],
})
export class StaffIcalModule {}
