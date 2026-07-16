import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { StaffAuthModule } from './staff-auth/staff-auth.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
