import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BedKind,
  MediaKind,
  type Amenities,
  type BedConfigRoom,
  type MediaItem,
} from '@cabin/api-contract';

export class MediaItemDto implements MediaItem {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsEnum(MediaKind)
  kind!: MediaKind;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  mimeType!: string;
}

export class BedRowDto {
  @IsEnum(BedKind)
  type!: BedKind;

  @IsInt()
  @Min(1)
  count!: number;
}

export class BedConfigRoomDto implements BedConfigRoom {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  room!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BedRowDto)
  beds!: BedRowDto[];
}

export class AmenitiesDto implements Amenities {
  @IsArray()
  @IsString({ each: true })
  highlights!: string[];

  @IsArray()
  @IsString({ each: true })
  kitchen!: string[];

  @IsArray()
  @IsString({ each: true })
  bathroom!: string[];

  @IsArray()
  @IsString({ each: true })
  view!: string[];

  @IsArray()
  @IsString({ each: true })
  facilities!: string[];
}
