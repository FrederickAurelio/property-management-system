import { Module } from '@nestjs/common';
import { ArchiveStorageModule } from '../../integrations/archive/archive-storage.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { ArchiveController } from './archive.controller.js';
import { ArchiveService } from './archive.service.js';

@Module({
  imports: [StaffAuthModule, ArchiveStorageModule],
  controllers: [ArchiveController],
  providers: [ArchiveService],
})
export class ArchiveModule {}
