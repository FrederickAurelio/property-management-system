import { Module } from '@nestjs/common';
import { DashboardModule } from '../../domain/dashboard/dashboard.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { DashboardController } from './dashboard.controller.js';

@Module({
  imports: [StaffAuthModule, DashboardModule],
  controllers: [DashboardController],
})
export class StaffDashboardModule {}
