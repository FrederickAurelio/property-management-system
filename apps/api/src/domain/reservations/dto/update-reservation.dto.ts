import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
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

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  unitTypeId?: string;

  @IsOptional()
  @IsEnum(StayBillingPeriod)
  billingPeriod?: StayBillingPeriod;

  @IsOptional()
  @IsString()
  checkInDate?: string;

  @IsOptional()
  @IsString()
  checkOutDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(RESERVATION_GUEST_NAME_MIN)
  @MaxLength(RESERVATION_GUEST_NAME_MAX)
  guestName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(RESERVATION_GUEST_EMAIL_MAX)
  guestEmail?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(RESERVATION_GUEST_PHONE_MAX)
  guestPhone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(RESERVATION_NOTES_MAX)
  notes?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalAmountIdr?: number | null;

  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;
}
