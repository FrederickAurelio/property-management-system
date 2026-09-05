import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { PropertyExpenseCategory } from '@cabin/api-contract';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class ListPropertyExpensesQueryDto extends PaginationQueryDto {
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(YMD)
  from!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(YMD)
  to!: string;

  @IsOptional()
  @IsEnum(PropertyExpenseCategory)
  category?: PropertyExpenseCategory;
}
