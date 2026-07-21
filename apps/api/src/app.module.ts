import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { StaffAuthModule } from './staff/auth/staff-auth.module';
import { AdminsModule } from './staff/admins/admins.module';
import { MediaModule } from './staff/media/media.module.js';
import { StaffPropertiesModule } from './staff/properties/properties.module.js';
import { StaffUnitTypesModule } from './staff/unit-types/unit-types.module.js';
import { StaffUnitsModule } from './staff/units/units.module.js';
import { StaffReservationsModule } from './staff/reservations/reservations.module.js';
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
    PrismaModule,
    StaffAuthModule,
    AdminsModule,
    MediaModule,
    StaffPropertiesModule,
    StaffUnitTypesModule,
    StaffUnitsModule,
    StaffReservationsModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
