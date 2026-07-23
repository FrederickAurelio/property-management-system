import { Module } from '@nestjs/common';
import { ReportsModule } from '../../domain/reports/reports.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [StaffAuthModule, ReportsModule],
  controllers: [ReportsController],
})
export class StaffReportsModule {}
