import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  Paginated,
  StaffAdmin,
  StaffReservation,
  StaffReservationListItem,
} from '@cabin/api-contract';
import { CancelReservationDto } from '../../domain/reservations/dto/cancel-reservation.dto.js';
import { ConfirmEarlyDto } from '../../domain/reservations/dto/confirm-early.dto.js';
import { CreateReservationDto } from '../../domain/reservations/dto/create-reservation.dto.js';
import { ListReservationsQueryDto } from '../../domain/reservations/dto/list-reservations.query.dto.js';
import { PostPaymentMovementDto } from '../../domain/reservations/dto/post-payment-movement.dto.js';
import { PutReservationUtilitiesDto } from '../../domain/reservations/dto/put-reservation-utilities.dto.js';
import { UpdateReservationDto } from '../../domain/reservations/dto/update-reservation.dto.js';
import { ReservationsService } from '../../domain/reservations/reservations.service.js';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator.js';
import { StaffRoles } from '../auth/decorators/staff-roles.decorator.js';
import { StaffRolesGuard } from '../auth/guards/staff-roles.guard.js';
import { StaffSessionAuthGuard } from '../auth/guards/staff-session-auth.guard.js';

@Controller('staff/reservations')
@UseGuards(StaffSessionAuthGuard, StaffRolesGuard)
@StaffRoles('FRONT_DESK')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  list(
    @Query() query: ListReservationsQueryDto,
  ): Promise<Paginated<StaffReservationListItem>> {
    return this.reservationsService.list(query);
  }

  @Post()
  create(
    @Body() dto: CreateReservationDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.create(dto, admin);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<StaffReservation> {
    return this.reservationsService.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.update(id, dto, admin);
  }

  @Put(':id/utilities')
  putUtilities(
    @Param('id') id: string,
    @Body() dto: PutReservationUtilitiesDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.putUtilities(id, dto, admin);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') id: string,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.confirm(id, admin);
  }

  @Post(':id/check-in')
  checkIn(
    @Param('id') id: string,
    @Body() dto: ConfirmEarlyDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.checkIn(id, dto, admin);
  }

  @Post(':id/check-out')
  checkOut(
    @Param('id') id: string,
    @Body() dto: ConfirmEarlyDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.checkOut(id, dto, admin);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.cancel(id, dto, admin);
  }

  @Post(':id/movements')
  postMovement(
    @Param('id') id: string,
    @Body() dto: PostPaymentMovementDto,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.postMovement(id, dto, admin);
  }

  @Post(':id/accept-ical-dates')
  acceptIcalDates(
    @Param('id') id: string,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.acceptIcalDates(id, admin);
  }

  @Post(':id/accept-ical-unit')
  acceptIcalUnit(
    @Param('id') id: string,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.acceptIcalUnit(id, admin);
  }

  @Post(':id/dismiss-ical-warning')
  dismissIcalWarning(
    @Param('id') id: string,
    @CurrentAdmin() admin: StaffAdmin,
  ): Promise<StaffReservation> {
    return this.reservationsService.dismissIcalWarning(id, admin);
  }
}
