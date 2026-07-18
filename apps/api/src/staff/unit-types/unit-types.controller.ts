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
import type { Paginated, StaffUnitType } from '@cabin/api-contract';
import { CreateUnitTypeDto } from '../../domain/unit-types/dto/create-unit-type.dto.js';
import { ListUnitTypesQueryDto } from '../../domain/unit-types/dto/list-unit-types.query.dto.js';
import { UpdateUnitTypeDto } from '../../domain/unit-types/dto/update-unit-type.dto.js';
import { UnitTypesService } from '../../domain/unit-types/unit-types.service.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class UnitTypesController {
  constructor(private readonly unitTypesService: UnitTypesService) {}

  @Get('properties/:propertyId/unit-types')
  list(
    @Param('propertyId') propertyId: string,
    @Query() query: ListUnitTypesQueryDto,
  ): Promise<Paginated<StaffUnitType>> {
    return this.unitTypesService.listByProperty(propertyId, query);
  }

  @Post('properties/:propertyId/unit-types')
  @StaffRoles('ADMIN')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateUnitTypeDto,
  ): Promise<StaffUnitType> {
    return this.unitTypesService.create(propertyId, dto);
  }

  @Get('unit-types/:id')
  getById(@Param('id') id: string): Promise<StaffUnitType> {
    return this.unitTypesService.getById(id);
  }

  @Patch('unit-types/:id')
  @StaffRoles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitTypeDto,
  ): Promise<StaffUnitType> {
    return this.unitTypesService.update(id, dto);
  }

  @Delete('unit-types/:id')
  @StaffRoles('ADMIN')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.unitTypesService.delete(id);
  }
}
