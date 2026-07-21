import { Module } from '@nestjs/common';
import { ReservationsModule } from '../../domain/reservations/reservations.module.js';
import { StaffAuthModule } from '../auth/staff-auth.module.js';
import { ReservationsController } from './reservations.controller.js';

@Module({
  imports: [StaffAuthModule, ReservationsModule],
  controllers: [ReservationsController],
})
export class StaffReservationsModule {}
