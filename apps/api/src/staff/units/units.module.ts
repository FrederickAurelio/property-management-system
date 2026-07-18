import { Module } from '@nestjs/common';
import { UnitsModule } from '../../domain/units/units.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { UnitsController } from './units.controller.js';

@Module({
  imports: [StaffAuthModule, UnitsModule],
  controllers: [UnitsController],
})
export class StaffUnitsModule {}
