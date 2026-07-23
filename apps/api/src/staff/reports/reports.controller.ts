import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { StaffReportsSummary } from '@cabin/api-contract';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard';
import { ReportsSummaryQueryDto } from '../../domain/reports/dto/reports-summary.query.dto.js';
import { ReportsService } from '../../domain/reports/reports.service.js';

@Controller('staff/reports')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(
    @Query() query: ReportsSummaryQueryDto,
  ): Promise<StaffReportsSummary> {
    return this.reportsService.getSummary(query);
  }
}
