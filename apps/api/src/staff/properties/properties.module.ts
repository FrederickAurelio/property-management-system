import { Module } from '@nestjs/common';
import { PropertiesModule } from '../../domain/properties/properties.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { PropertiesController } from './properties.controller.js';

@Module({
  imports: [StaffAuthModule, PropertiesModule],
  controllers: [PropertiesController],
})
export class StaffPropertiesModule {}
