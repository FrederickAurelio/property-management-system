import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PROPERTY_EXPENSE_AMOUNT_IDR_MAX,
  PROPERTY_EXPENSE_AMOUNT_IDR_MIN,
  PROPERTY_EXPENSE_NOTE_MAX,
  PROPERTY_EXPENSE_PROOF_MAX,
  PropertyExpenseCategory,
} from '@cabin/api-contract';
import { ArchiveProofImageDto } from '../../reservations/dto/archive-proof-image.dto.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class UpdatePropertyExpenseDto {
  @IsOptional()
  @IsString()
  @Matches(YMD)
  occurredOn?: string;

  @IsOptional()
  @IsEnum(PropertyExpenseCategory)
  category?: PropertyExpenseCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PROPERTY_EXPENSE_AMOUNT_IDR_MIN)
  @Max(PROPERTY_EXPENSE_AMOUNT_IDR_MAX)
  amountIdr?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  unitId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(PROPERTY_EXPENSE_NOTE_MAX)
  note?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PROPERTY_EXPENSE_PROOF_MAX)
  @ValidateNested({ each: true })
  @Type(() => ArchiveProofImageDto)
  proofImages?: ArchiveProofImageDto[];
}
