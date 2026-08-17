import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ArchiveKind } from '@cabin/api-contract';

/** One Garage proof photo (ArchiveItem wire shape) — utilities + cash movements. */
export class ArchiveProofImageDto {
  @IsEnum(ArchiveKind)
  kind!: (typeof ArchiveKind)[keyof typeof ArchiveKind];

  @IsString()
  id!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  byteSize?: number;
}
