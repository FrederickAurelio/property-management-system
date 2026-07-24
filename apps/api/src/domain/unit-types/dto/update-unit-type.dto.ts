import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  INVENTORY_CODE_MAX,
  INVENTORY_CODE_MIN,
  INVENTORY_CODE_PATTERN,
  INVENTORY_NAME_MAX,
  INVENTORY_NAME_MIN,
  UNIT_TYPE_DAILY_PRICE_IDR_MAX,
  UNIT_TYPE_MONTHLY_PRICE_IDR_MAX,
  UNIT_TYPE_YEARLY_PRICE_IDR_MAX,
  UnitLayout,
} from '@cabin/api-contract';
import {
  AmenitiesDto,
  BedConfigRoomDto,
  MediaItemDto,
} from '../../inventory/inventory-json.dto.js';

export class UpdateUnitTypeDto {
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(INVENTORY_NAME_MIN)
  @MaxLength(INVENTORY_NAME_MAX)
  name?: string;

  @IsOptional()
  @IsEnum(UnitLayout)
  layout?: UnitLayout;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sizeSqm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  bathroomCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxGuests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_DAILY_PRICE_IDR_MAX)
  defaultPriceIdr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_MONTHLY_PRICE_IDR_MAX)
  monthlyPriceIdr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_YEARLY_PRICE_IDR_MAX)
  yearlyPriceIdr?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BedConfigRoomDto)
  bedConfig?: BedConfigRoomDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AmenitiesDto)
  amenities?: AmenitiesDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  smokingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
