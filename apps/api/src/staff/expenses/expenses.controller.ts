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
  StaffAdmin,
  StaffPropertyExpense,
} from '@cabin/api-contract';
import { CreatePropertyExpenseDto } from '../../domain/expenses/dto/create-property-expense.dto.js';
import { ListPropertyExpensesQueryDto } from '../../domain/expenses/dto/list-property-expenses.query.dto.js';
import { UpdatePropertyExpenseDto } from '../../domain/expenses/dto/update-property-expense.dto.js';
import { ExpensesService } from '../../domain/expenses/expenses.service.js';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff/expenses')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('ADMIN')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  list(
    @Query() query: ListPropertyExpensesQueryDto,
  ): Promise<Paginated<StaffPropertyExpense>> {
    return this.expensesService.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<StaffPropertyExpense> {
    return this.expensesService.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreatePropertyExpenseDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffPropertyExpense> {
    return this.expensesService.create(dto, admin);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyExpenseDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffPropertyExpense> {
    return this.expensesService.update(id, dto, admin);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<{ ok: true }> {
    return this.expensesService.delete(id);
  }
}
