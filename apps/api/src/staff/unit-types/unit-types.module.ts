import { Module } from '@nestjs/common';
import { UnitTypesModule } from '../../domain/unit-types/unit-types.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { UnitTypesController } from './unit-types.controller.js';

@Module({
  imports: [StaffAuthModule, UnitTypesModule],
  controllers: [UnitTypesController],
})
export class StaffUnitTypesModule {}
