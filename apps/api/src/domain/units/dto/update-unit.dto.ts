import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  INVENTORY_CODE_MAX,
  INVENTORY_CODE_MIN,
  INVENTORY_CODE_PATTERN,
  INVENTORY_FLOOR_MAX,
  INVENTORY_NAME_MAX,
  UnitStatus,
} from '@cabin/api-contract';
import { UnitIcalFeedInputDto } from './create-unit.dto.js';

export class UpdateUnitDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(INVENTORY_CODE_MIN)
  @MaxLength(INVENTORY_CODE_MAX)
  @Matches(INVENTORY_CODE_PATTERN, {
    message: 'Code may only contain letters, numbers, underscores, or hyphens',
  })
  code?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(INVENTORY_NAME_MAX)
  name?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(INVENTORY_FLOOR_MAX)
  floor?: string | null;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => UnitIcalFeedInputDto)
  icalFeeds?: UnitIcalFeedInputDto[];
}
