import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module.js';
import { PropertiesController } from './properties.controller.js';
import { PropertiesService } from './properties.service.js';

@Module({
  imports: [StaffAuthModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
