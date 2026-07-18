import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module.js';
import { UnitsController } from './units.controller.js';
import { UnitsService } from './units.service.js';

@Module({
  imports: [StaffAuthModule],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
