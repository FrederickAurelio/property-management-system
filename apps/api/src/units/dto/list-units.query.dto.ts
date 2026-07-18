import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { UnitStatus } from '@cabin/api-contract';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListUnitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  unitTypeId?: string;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
