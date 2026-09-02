import { Module } from '@nestjs/common';
import { PdfConvertModule } from '../../integrations/pdf-convert/pdf-convert.module.js';
import { IcalDomainModule } from '../ical/ical.module.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [IcalDomainModule, PdfConvertModule],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
