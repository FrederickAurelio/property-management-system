import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CabinThrottlerGuard } from './common/http/throttler/cabin-throttler.guard.js';
import { throttlerModuleOptions } from './common/http/throttler/throttler.options.js';
import { pinoHttpOptions } from './common/http/pino-http.options.js';
import { PrismaModule } from './prisma/prisma.module';
import { StaffAuthModule } from './staff/auth/staff-auth.module';
import { AdminsModule } from './staff/admins/admins.module';
import { MediaModule } from './staff/media/media.module.js';
import { ArchiveModule } from './staff/archive/archive.module.js';
import { StaffPropertiesModule } from './staff/properties/properties.module.js';
import { StaffUnitTypesModule } from './staff/unit-types/unit-types.module.js';
import { StaffUnitsModule } from './staff/units/units.module.js';
import { StaffReservationsModule } from './staff/reservations/reservations.module.js';
import { StaffCalendarModule } from './staff/calendar/calendar.module.js';
import { StaffReportsModule } from './staff/reports/reports.module.js';
import { StaffRequestLogsModule } from './staff/request-logs/request-logs.module.js';
import { StaffDashboardModule } from './staff/dashboard/dashboard.module.js';
import { StaffIcalModule } from './staff/ical/ical.module.js';
import { PublicModule } from './public/public.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Single source: repo root `.env` (Compose + DATABASE_URL)
      envFilePath: [
        join(process.cwd(), '../../.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: pinoHttpOptions(),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(throttlerModuleOptions()),
    PrismaModule,
    StaffAuthModule,
    AdminsModule,
    MediaModule,
    ArchiveModule,
    StaffPropertiesModule,
    StaffUnitTypesModule,
    StaffUnitsModule,
    StaffReservationsModule,
    StaffCalendarModule,
    StaffReportsModule,
    StaffRequestLogsModule,
    StaffDashboardModule,
    StaffIcalModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: CabinThrottlerGuard },
  ],
})
export class AppModule {}
