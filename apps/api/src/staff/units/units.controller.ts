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
import type { Paginated, StaffUnit } from '@cabin/api-contract';
import { CreateUnitDto } from '../../domain/units/dto/create-unit.dto.js';
import { ListUnitsQueryDto } from '../../domain/units/dto/list-units.query.dto.js';
import { UpdateUnitDto } from '../../domain/units/dto/update-unit.dto.js';
import { UnitsService } from '../../domain/units/units.service.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get('properties/:propertyId/units')
  list(
    @Param('propertyId') propertyId: string,
    @Query() query: ListUnitsQueryDto,
  ): Promise<Paginated<StaffUnit>> {
    return this.unitsService.listByProperty(propertyId, query);
  }

  @Post('properties/:propertyId/units')
  @StaffRoles('ADMIN')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateUnitDto,
  ): Promise<StaffUnit> {
    return this.unitsService.create(propertyId, dto);
  }

  @Get('units/:id')
  getById(@Param('id') id: string): Promise<StaffUnit> {
    return this.unitsService.getById(id);
  }

  @Patch('units/:id')
  @StaffRoles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<StaffUnit> {
    return this.unitsService.update(id, dto);
  }

  @Delete('units/:id')
  @StaffRoles('ADMIN')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.unitsService.delete(id);
  }
}
