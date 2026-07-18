import { Module } from '@nestjs/common';
import { UnitTypesService } from './unit-types.service.js';

@Module({
  providers: [UnitTypesService],
  exports: [UnitTypesService],
})
export class UnitTypesModule {}
