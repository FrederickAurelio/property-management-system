import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { StaffDashboard } from '@cabin/api-contract';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard';
import { DashboardQueryDto } from '../../domain/dashboard/dto/dashboard.query.dto.js';
import { DashboardService } from '../../domain/dashboard/dashboard.service.js';

@Controller('staff/dashboard')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@Query() query: DashboardQueryDto): Promise<StaffDashboard> {
    return this.dashboardService.getDashboard(query);
  }
}
