import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module.js';
import { UnitTypesController } from './unit-types.controller.js';
import { UnitTypesService } from './unit-types.service.js';

@Module({
  imports: [StaffAuthModule],
  controllers: [UnitTypesController],
  providers: [UnitTypesService],
  exports: [UnitTypesService],
})
export class UnitTypesModule {}
