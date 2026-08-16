import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PAGE_MIN,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  REQUEST_ID_PATTERN,
  REQUEST_LOGS_ACTOR_MAX,
  REQUEST_LOGS_PATH_MAX,
  REQUEST_LOGS_Q_MAX,
  REQUEST_LOGS_REQUEST_ID_MAX,
} from '@cabin/api-contract';

export class RequestLogsQueryDto {
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
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(REQUEST_LOGS_Q_MAX)
  q?: string;

  @IsOptional()
  @IsIn(['pms', 'web'])
  app?: 'pms' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(REQUEST_LOGS_ACTOR_MAX)
  actor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(REQUEST_LOGS_PATH_MAX)
  path?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return false;
    if (value === '1' || value === 1 || value === 'true' || value === true) {
      return true;
    }
    if (value === '0' || value === 0 || value === 'false' || value === false) {
      return false;
    }
    return value;
  })
  @IsBoolean()
  errorsOnly?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(REQUEST_LOGS_REQUEST_ID_MAX)
  @Matches(REQUEST_ID_PATTERN)
  requestId?: string;
}
