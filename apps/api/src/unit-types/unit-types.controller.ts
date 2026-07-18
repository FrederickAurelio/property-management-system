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
import type { Paginated, PublicUnitType } from '@cabin/api-contract';
import { StaffRoles } from '../staff-auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../staff-auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../staff-auth/guards/staff-session-auth.guard.js';
import { CreateUnitTypeDto } from './dto/create-unit-type.dto.js';
import { ListUnitTypesQueryDto } from './dto/list-unit-types.query.dto.js';
import { UpdateUnitTypeDto } from './dto/update-unit-type.dto.js';
import { UnitTypesService } from './unit-types.service.js';

@Controller()
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class UnitTypesController {
  constructor(private readonly unitTypesService: UnitTypesService) {}

  @Get('properties/:propertyId/unit-types')
  list(
    @Param('propertyId') propertyId: string,
    @Query() query: ListUnitTypesQueryDto,
  ): Promise<Paginated<PublicUnitType>> {
    return this.unitTypesService.listByProperty(propertyId, query);
  }

  @Post('properties/:propertyId/unit-types')
  @StaffRoles('ADMIN')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateUnitTypeDto,
  ): Promise<PublicUnitType> {
    return this.unitTypesService.create(propertyId, dto);
  }

  @Get('unit-types/:id')
  getById(@Param('id') id: string): Promise<PublicUnitType> {
    return this.unitTypesService.getById(id);
  }

  @Patch('unit-types/:id')
  @StaffRoles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitTypeDto,
  ): Promise<PublicUnitType> {
    return this.unitTypesService.update(id, dto);
  }

  @Delete('unit-types/:id')
  @StaffRoles('ADMIN')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.unitTypesService.delete(id);
  }
}
