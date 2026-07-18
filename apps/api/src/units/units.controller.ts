import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Paginated, PublicUnit } from '@cabin/api-contract';
import { StaffRoles } from '../staff-auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../staff-auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../staff-auth/guards/staff-session-auth.guard.js';
import { CreateUnitDto } from './dto/create-unit.dto.js';
import { ListUnitsQueryDto } from './dto/list-units.query.dto.js';
import { UpdateUnitDto } from './dto/update-unit.dto.js';
import { UnitsService } from './units.service.js';

@Controller()
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get('properties/:propertyId/units')
  list(
    @Param('propertyId') propertyId: string,
    @Query() query: ListUnitsQueryDto,
  ): Promise<Paginated<PublicUnit>> {
    return this.unitsService.listByProperty(propertyId, query);
  }

  @Post('properties/:propertyId/units')
  @StaffRoles('ADMIN')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateUnitDto,
  ): Promise<PublicUnit> {
    return this.unitsService.create(propertyId, dto);
  }

  @Get('units/:id')
  getById(@Param('id') id: string): Promise<PublicUnit> {
    return this.unitsService.getById(id);
  }

  @Patch('units/:id')
  @StaffRoles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<PublicUnit> {
    return this.unitsService.update(id, dto);
  }

  @Delete('units/:id')
  @StaffRoles('ADMIN')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.unitsService.delete(id);
  }
}
