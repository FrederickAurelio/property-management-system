import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type {
  ArchiveUploadIntent,
  StaffArchiveConfig,
} from '@cabin/api-contract';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard';
import { ArchiveService } from './archive.service';
import { CreateArchiveUploadIntentDto } from './dto/create-archive-upload-intent.dto';

@Controller('staff/archive')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('config')
  getConfig(): StaffArchiveConfig {
    return this.archiveService.getConfig();
  }

  @Post('upload-intent')
  createUploadIntent(
    @Body() dto: CreateArchiveUploadIntentDto,
  ): Promise<ArchiveUploadIntent> {
    return this.archiveService.createUploadIntent(dto);
  }
}
