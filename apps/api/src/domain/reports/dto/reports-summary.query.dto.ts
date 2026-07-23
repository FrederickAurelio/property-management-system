import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ReportsSummaryQueryDto {
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  /** Inclusive primary period start YYYY-MM-DD. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  /** Inclusive primary period end YYYY-MM-DD. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  /**
   * When true (default), include previous equal-length compare bundle.
   * Accepts `1` / `0` / `true` / `false` from query string.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return true;
    if (value === '1' || value === 1 || value === 'true' || value === true) {
      return true;
    }
    if (value === '0' || value === 0 || value === 'false' || value === false) {
      return false;
    }
    return value;
  })
  @IsBoolean()
  compare?: boolean;
}
