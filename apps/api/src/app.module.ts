import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminsModule } from './admins/admins.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module.js';
import { StaffAuthModule } from './staff-auth/staff-auth.module';
import { UnitTypesModule } from './unit-types/unit-types.module.js';
import { UnitsModule } from './units/units.module.js';

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
    PropertiesModule,
    UnitTypesModule,
    UnitsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
