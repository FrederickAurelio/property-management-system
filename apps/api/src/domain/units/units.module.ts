import { Module } from '@nestjs/common';
import { UnitsService } from './units.service.js';

@Module({
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
