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
import {
  CollectedVia,
  PAYMENT_MOVEMENT_NOTE_MAX,
  PaymentMovementDirection,
  PaymentMovementKind,
} from '@cabin/api-contract';

export class PostPaymentMovementDto {
  @IsEnum(PaymentMovementDirection)
  direction!: PaymentMovementDirection;

  @IsEnum(PaymentMovementKind)
  kind!: PaymentMovementKind;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountIdr!: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(CollectedVia)
  method?: CollectedVia | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(PAYMENT_MOVEMENT_NOTE_MAX)
  note?: string | null;
}
