import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
  INVENTORY_ADDRESS_MAX,
  INVENTORY_CITY_MAX,
  INVENTORY_CODE_MAX,
  INVENTORY_CODE_MIN,
  INVENTORY_CODE_PATTERN,
  INVENTORY_COUNTRY_CODE_LENGTH,
  INVENTORY_GOOGLE_PLACE_ID_MAX,
  INVENTORY_HHMM_PATTERN,
  INVENTORY_LAT_MAX,
  INVENTORY_LAT_MIN,
  INVENTORY_LNG_MAX,
  INVENTORY_LNG_MIN,
  INVENTORY_NAME_MAX,
  INVENTORY_NAME_MIN,
  INVENTORY_TIMEZONE_MAX,
} from '@cabin/api-contract';
import { MediaItemDto } from '../../inventory/inventory-json.dto.js';

export class UpdatePropertyDto {
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(INVENTORY_TIMEZONE_MAX)
  timezone?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(INVENTORY_HHMM_PATTERN)
  checkInFrom?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(INVENTORY_HHMM_PATTERN)
  checkInUntil?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(INVENTORY_HHMM_PATTERN)
  checkOutFrom?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(INVENTORY_HHMM_PATTERN)
  checkOutUntil?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(INVENTORY_ADDRESS_MAX)
  addressLine?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(INVENTORY_CITY_MAX)
  city?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(INVENTORY_COUNTRY_CODE_LENGTH)
  @MinLength(INVENTORY_COUNTRY_CODE_LENGTH)
  countryCode?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(INVENTORY_LAT_MIN)
  @Max(INVENTORY_LAT_MAX)
  latitude?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(INVENTORY_LNG_MIN)
  @Max(INVENTORY_LNG_MAX)
  longitude?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(INVENTORY_GOOGLE_PLACE_ID_MAX)
  googlePlaceId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => MediaItemDto)
  coverImage?: MediaItemDto | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
