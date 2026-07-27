import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
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
  UNIT_ICAL_IMPORT_URL_MAX,
  UnitIcalFeedSource,
  UnitStatus,
} from '@cabin/api-contract';

export class UnitIcalFeedInputDto {
  @IsEnum(UnitIcalFeedSource)
  source!: (typeof UnitIcalFeedSource)[keyof typeof UnitIcalFeedSource];

  /** Empty string = disconnect this source. */
  @IsString()
  @MaxLength(UNIT_ICAL_IMPORT_URL_MAX)
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
    require_tld: false,
  })
  importUrl!: string;
}

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  unitTypeId!: string;

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

  @IsEnum(UnitStatus)
  status!: UnitStatus;

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
