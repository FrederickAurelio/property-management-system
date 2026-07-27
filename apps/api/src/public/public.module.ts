import { Module } from '@nestjs/common';
import { PublicIcalModule } from './ical/ical.module.js';

/** Public HTTP (`/public/...`) — Phase 1 iCal export; Phase 2 browse/book. */
@Module({
  imports: [PublicIcalModule],
})
export class PublicModule {}
