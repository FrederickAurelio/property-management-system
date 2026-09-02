import { IsString, Matches } from 'class-validator';

export class UtilityStatementQueryDto {
  /** Billed calendar month `YYYY-MM` (same as the utilities sheet). */
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  chargeYearMonth!: string;
}
