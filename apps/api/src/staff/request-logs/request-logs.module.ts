import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { LokiQueryClient } from './loki-query.client.js';
import { RequestLogsController } from './request-logs.controller.js';
import { RequestLogsService } from './request-logs.service.js';

@Module({
  imports: [StaffAuthModule],
  controllers: [RequestLogsController],
  providers: [RequestLogsService, LokiQueryClient],
})
export class StaffRequestLogsModule {}
