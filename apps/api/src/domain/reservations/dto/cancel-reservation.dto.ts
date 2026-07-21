import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CancelDisposition, RESERVATION_NOTES_MAX } from '@cabin/api-contract';

export class CancelReservationDto {
  @IsOptional()
  @IsEnum(CancelDisposition)
  disposition?: CancelDisposition;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  refundAmountIdr?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(RESERVATION_NOTES_MAX)
  notes?: string | null;
}
