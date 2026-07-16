import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}
