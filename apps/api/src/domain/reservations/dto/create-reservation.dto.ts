import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  RESERVATION_GUEST_EMAIL_MAX,
  RESERVATION_GUEST_NAME_MAX,
  RESERVATION_GUEST_NAME_MIN,
  RESERVATION_GUEST_PHONE_MAX,
  RESERVATION_NOTES_MAX,
  ReservationSource,
  StayBillingPeriod,
} from '@cabin/api-contract';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @IsString()
  @IsNotEmpty()
  unitTypeId!: string;

  @IsEnum(ReservationSource)
  source!: ReservationSource;

  @IsEnum(StayBillingPeriod)
  billingPeriod!: StayBillingPeriod;

  @IsString()
  @IsNotEmpty()
  checkInDate!: string;

  @IsString()
  @IsNotEmpty()
  checkOutDate!: string;

  @IsString()
  @MinLength(RESERVATION_GUEST_NAME_MIN)
  @MaxLength(RESERVATION_GUEST_NAME_MAX)
  guestName!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(RESERVATION_GUEST_EMAIL_MAX)
  guestEmail?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(RESERVATION_GUEST_PHONE_MAX)
  guestPhone?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(RESERVATION_NOTES_MAX)
  notes?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalAmountIdr!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  depositAmountIdr!: number;
}
