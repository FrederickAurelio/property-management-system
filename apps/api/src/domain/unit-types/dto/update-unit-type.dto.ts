import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  UNIT_TYPE_UTILITY_RATE_IDR_MAX,
  UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX,
  UTILITY_ADDON_MAX_PER_KIND,
  UTILITY_METER_FRACTION_DIGITS,
  UTILITY_METER_VALUE_MAX,
  UnitLayout,
} from '@cabin/api-contract';
import {
  AmenitiesDto,
  BedConfigRoomDto,
  MediaItemDto,
} from '../../inventory/inventory-json.dto.js';
import { UtilityAddonInputDto } from './utility-addon-input.dto.js';

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_UTILITY_RATE_IDR_MAX)
  electricityRateIdrPerKwh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_UTILITY_RATE_IDR_MAX)
  waterRateIdrPerM3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX)
  maintenanceFeeIdrPerMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: UTILITY_METER_FRACTION_DIGITS },
    {
      message: `electricityMinKwh allows at most ${UTILITY_METER_FRACTION_DIGITS} decimal places`,
    },
  )
  @Min(0)
  @Max(UTILITY_METER_VALUE_MAX)
  electricityMinKwh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX)
  adminFeeIdrPerMonth?: number;

  /**
   * Omit to leave existing rows. Provided (including `[]`) is a replace-set:
   * delete all add-ons for this type, then create the payload.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(UTILITY_ADDON_MAX_PER_KIND * 2)
  @ValidateNested({ each: true })
  @Type(() => UtilityAddonInputDto)
  utilityAddons?: UtilityAddonInputDto[];

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
