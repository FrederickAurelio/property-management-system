import { Module } from '@nestjs/common';
import { IcalDomainModule } from '../../domain/ical/ical.module.js';
import { PublicIcalController } from './ical.controller.js';

@Module({
  imports: [IcalDomainModule],
  controllers: [PublicIcalController],
})
export class PublicIcalModule {}
