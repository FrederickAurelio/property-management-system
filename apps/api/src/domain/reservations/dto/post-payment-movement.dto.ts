import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CollectedVia,
  PAYMENT_MOVEMENT_NOTE_MAX,
  PAYMENT_MOVEMENT_PROOF_MAX,
  PaymentMovementDirection,
  PaymentMovementKind,
} from '@cabin/api-contract';
import { ArchiveProofImageDto } from './archive-proof-image.dto.js';

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PAYMENT_MOVEMENT_PROOF_MAX)
  @ValidateNested({ each: true })
  @Type(() => ArchiveProofImageDto)
  proofImages?: ArchiveProofImageDto[];
}
