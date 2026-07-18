import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PAGE_MIN,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
} from '@cabin/api-contract';

/** Shared list query: page / pageSize / optional search. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGE_MIN)
  page: number = PAGE_MIN;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  pageSize: number = PAGE_SIZE_DEFAULT;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  q?: string;
}
