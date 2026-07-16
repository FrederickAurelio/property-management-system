import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { PublicAdmin } from '@cabin/api-contract';
import { CurrentAdmin } from '../staff-auth/decorators/current-admin.decorator';
import { StaffRoles } from '../staff-auth/decorators/staff-roles.decorator';
import { StaffRolesGuard } from '../staff-auth/guards/staff-roles.guard';
import { StaffSessionAuthGuard } from '../staff-auth/guards/staff-session-auth.guard';
import { AdminsService } from './admins.service';
import { ChangeAdminRoleDto } from './dto/change-admin-role.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { SetAdminActiveDto } from './dto/set-admin-active.dto';

@Controller('admins')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('SUPER_ADMIN')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  list(): Promise<PublicAdmin[]> {
    return this.adminsService.list();
  }

  @Post()
  create(
    @CurrentAdmin() actor: PublicAdmin,
    @Body() dto: CreateAdminDto,
  ): Promise<PublicAdmin> {
    return this.adminsService.create(actor.id, {
      username: dto.username,
      password: dto.password,
      role: dto.role,
      currentPassword: dto.currentPassword,
    });
  }

  @Patch(':id/role')
  changeRole(
    @CurrentAdmin() actor: PublicAdmin,
    @Param('id') id: string,
    @Body() dto: ChangeAdminRoleDto,
  ): Promise<PublicAdmin> {
    return this.adminsService.changeRole(actor.id, id, {
      role: dto.role,
      currentPassword: dto.currentPassword,
    });
  }

  @Patch(':id/active')
  setActive(
    @CurrentAdmin() actor: PublicAdmin,
    @Param('id') id: string,
    @Body() dto: SetAdminActiveDto,
  ): Promise<PublicAdmin> {
    return this.adminsService.setActive(actor.id, id, {
      isActive: dto.isActive,
      currentPassword: dto.currentPassword,
    });
  }
}
