import { Controller, Post, UseGuards } from '@nestjs/common';
import type { StaffIcalSyncAllResult } from '@cabin/api-contract';
import { IcalImportService } from '../../domain/ical/ical-import.service.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff/ical')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class StaffIcalController {
  constructor(private readonly icalImportService: IcalImportService) {}

  @Post('sync-all')
  syncAll(): Promise<StaffIcalSyncAllResult> {
    return this.icalImportService.syncAll();
  }
}
