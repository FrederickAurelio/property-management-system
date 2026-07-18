import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { MediaUploadIntent } from '@cabin/api-contract';
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

  @Post('upload-intent')
  createUploadIntent(@Body() dto: CreateUploadIntentDto): MediaUploadIntent {
    return this.mediaService.createUploadIntent(dto);
  }
}
