import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
  UnitLayout,
} from '@cabin/api-contract';
import {
  AmenitiesDto,
  BedConfigRoomDto,
  MediaItemDto,
} from '../../common/inventory/inventory-json.dto.js';

export class CreateUnitTypeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(INVENTORY_CODE_MIN)
  @MaxLength(INVENTORY_CODE_MAX)
  @Matches(INVENTORY_CODE_PATTERN, {
    message: 'Code may only contain letters, numbers, underscores, or hyphens',
  })
  code!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(INVENTORY_NAME_MIN)
  @MaxLength(INVENTORY_NAME_MAX)
  name!: string;

  @IsEnum(UnitLayout)
  layout!: UnitLayout;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sizeSqm?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  bathroomCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxGuests!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  defaultPriceIdr!: number;

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
