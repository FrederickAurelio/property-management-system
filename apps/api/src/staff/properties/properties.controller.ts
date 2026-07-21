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
import type {
  Paginated,
  StaffProperty,
  StaffPropertyOption,
} from '@cabin/api-contract';
import { CreatePropertyDto } from '../../domain/properties/dto/create-property.dto.js';
import { ListPropertiesQueryDto } from '../../domain/properties/dto/list-properties.query.dto.js';
import { UpdatePropertyDto } from '../../domain/properties/dto/update-property.dto.js';
import { PropertiesService } from '../../domain/properties/properties.service.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff/properties')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  list(
    @Query() query: ListPropertiesQueryDto,
  ): Promise<Paginated<StaffProperty>> {
    return this.propertiesService.list(query);
  }

  /** Declared before `:id` so Nest does not treat `options` as an id. */
  @Get('options')
  listOptions(): Promise<StaffPropertyOption[]> {
    return this.propertiesService.listOptions();
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<StaffProperty> {
    return this.propertiesService.getById(id);
  }

  @Post()
  @StaffRoles('ADMIN')
  create(@Body() dto: CreatePropertyDto): Promise<StaffProperty> {
    return this.propertiesService.create(dto);
  }

  @Patch(':id')
  @StaffRoles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<StaffProperty> {
    return this.propertiesService.update(id, dto);
  }

  @Delete(':id')
  @StaffRoles('ADMIN')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.propertiesService.delete(id);
  }
}
