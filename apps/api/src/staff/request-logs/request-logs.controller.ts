import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { StaffRequestLogsList } from '@cabin/api-contract';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';
import { RequestLogsQueryDto } from './dto/request-logs.query.dto.js';
import { RequestLogsService } from './request-logs.service.js';

@Controller('staff/request-logs')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('ADMIN')
export class RequestLogsController {
  constructor(private readonly requestLogsService: RequestLogsService) {}

  @Get()
  list(@Query() query: RequestLogsQueryDto): Promise<StaffRequestLogsList> {
    return this.requestLogsService.list(query);
  }
}
