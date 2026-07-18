import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MediaKind,
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_VIDEO_MAX_BYTES,
} from '@cabin/api-contract';

const MEDIA_NAME_MAX = 255;
const MEDIA_BYTE_SIZE_CEILING = Math.max(
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_VIDEO_MAX_BYTES,
);

export class CreateUploadIntentDto {
  @IsEnum(MediaKind)
  kind!: MediaKind;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MEDIA_BYTE_SIZE_CEILING)
  byteSize!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MEDIA_NAME_MAX)
  name?: string;
}
