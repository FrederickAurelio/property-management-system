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
import type { Paginated, PublicProperty } from '@cabin/api-contract';
import { StaffRoles } from '../staff-auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../staff-auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../staff-auth/guards/staff-session-auth.guard.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { ListPropertiesQueryDto } from './dto/list-properties.query.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertiesService } from './properties.service.js';

@Controller('properties')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  list(
    @Query() query: ListPropertiesQueryDto,
  ): Promise<Paginated<PublicProperty>> {
    return this.propertiesService.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<PublicProperty> {
    return this.propertiesService.getById(id);
  }

  @Post()
  @StaffRoles('ADMIN')
  create(@Body() dto: CreatePropertyDto): Promise<PublicProperty> {
    return this.propertiesService.create(dto);
  }

  @Patch(':id')
  @StaffRoles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<PublicProperty> {
    return this.propertiesService.update(id, dto);
  }

  @Delete(':id')
  @StaffRoles('ADMIN')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.propertiesService.delete(id);
  }
}
