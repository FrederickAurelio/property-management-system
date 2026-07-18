import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { StaffAdmin } from '@cabin/api-contract';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard';
import { AdminsService } from './admins.service';
import { ChangeAdminRoleDto } from './dto/change-admin-role.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { SetAdminActiveDto } from './dto/set-admin-active.dto';

@Controller('staff/admins')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('SUPER_ADMIN')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  list(): Promise<StaffAdmin[]> {
    return this.adminsService.list();
  }

  @Post()
  create(
    @CurrentAdmin() actor: StaffAdmin,
    @Body() dto: CreateAdminDto,
  ): Promise<StaffAdmin> {
    return this.adminsService.create(actor.id, {
      username: dto.username,
      password: dto.password,
      role: dto.role,
      currentPassword: dto.currentPassword,
    });
  }

  @Patch(':id/role')
  changeRole(
    @CurrentAdmin() actor: StaffAdmin,
    @Param('id') id: string,
    @Body() dto: ChangeAdminRoleDto,
  ): Promise<StaffAdmin> {
    return this.adminsService.changeRole(actor.id, id, {
      role: dto.role,
      currentPassword: dto.currentPassword,
    });
  }

  @Patch(':id/active')
  setActive(
    @CurrentAdmin() actor: StaffAdmin,
    @Param('id') id: string,
    @Body() dto: SetAdminActiveDto,
  ): Promise<StaffAdmin> {
    return this.adminsService.setActive(actor.id, id, {
      isActive: dto.isActive,
      currentPassword: dto.currentPassword,
    });
  }
}
