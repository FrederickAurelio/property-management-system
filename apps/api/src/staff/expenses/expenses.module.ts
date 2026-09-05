import { Module } from '@nestjs/common';
import { ExpensesModule } from '../../domain/expenses/expenses.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { ExpensesController } from './expenses.controller.js';

@Module({
  imports: [StaffAuthModule, ExpensesModule],
  controllers: [ExpensesController],
})
export class StaffExpensesModule {}
