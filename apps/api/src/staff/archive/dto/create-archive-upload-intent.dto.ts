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
import { ArchiveKind, ARCHIVE_IMAGE_MAX_BYTES } from '@cabin/api-contract';

const ARCHIVE_NAME_MAX = 255;

export class CreateArchiveUploadIntentDto {
  @IsEnum(ArchiveKind)
  kind!: ArchiveKind;

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
  @Max(ARCHIVE_IMAGE_MAX_BYTES)
  byteSize!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(ARCHIVE_NAME_MAX)
  name?: string;
}
