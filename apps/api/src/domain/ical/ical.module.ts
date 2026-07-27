import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IcalExportService } from './ical-export.service.js';
import { IcalImportService } from './ical-import.service.js';

@Module({
  imports: [PrismaModule],
  providers: [IcalExportService, IcalImportService],
  exports: [IcalExportService, IcalImportService],
})
export class IcalDomainModule {}
