import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { MediaUploadIntent, StaffMediaConfig } from '@cabin/api-contract';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard';
import { CreateUploadIntentDto } from './dto/create-upload-intent.dto';
import { MediaService } from './media.service';

@Controller('staff/media')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('ADMIN')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('config')
  getConfig(): StaffMediaConfig {
    return this.mediaService.getConfig();
  }

  @Post('upload-intent')
  createUploadIntent(
    @Body() dto: CreateUploadIntentDto,
  ): Promise<MediaUploadIntent> {
    return this.mediaService.createUploadIntent(dto);
  }
}
