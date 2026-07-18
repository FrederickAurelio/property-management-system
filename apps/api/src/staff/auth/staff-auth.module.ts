import { Module } from '@nestjs/common';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffSessionAuthGuard } from './guards/staff-session-auth.guard';
import { StaffRolesGuard } from './guards/staff-roles.guard';

@Module({
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffSessionAuthGuard, StaffRolesGuard],
  exports: [StaffAuthService, StaffSessionAuthGuard, StaffRolesGuard],
})
export class StaffAuthModule {}
