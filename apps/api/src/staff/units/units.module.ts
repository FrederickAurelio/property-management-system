import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../../domain/availability/availability.module.js';
import { UnitsModule } from '../../domain/units/units.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { UnitsController } from './units.controller.js';

@Module({
  imports: [StaffAuthModule, UnitsModule, AvailabilityModule],
  controllers: [UnitsController],
})
export class StaffUnitsModule {}
