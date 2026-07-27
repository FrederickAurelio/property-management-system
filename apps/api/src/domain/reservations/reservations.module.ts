import { Module } from '@nestjs/common';
import { IcalDomainModule } from '../ical/ical.module.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [IcalDomainModule],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
