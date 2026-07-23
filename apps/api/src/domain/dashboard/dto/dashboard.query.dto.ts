import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class DashboardQueryDto {
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  /** Property-local YYYY-MM-DD; omit = today in property TZ. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
