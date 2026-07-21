import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UnitStatus } from '@cabin/api-contract';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class ListUnitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  unitTypeId?: string;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}
