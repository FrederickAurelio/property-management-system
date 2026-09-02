import { IsString, Matches } from 'class-validator';
import { UtilityStatementPayeeDto } from './utility-statement-payee.dto.js';

export class UtilityStatementQueryDto extends UtilityStatementPayeeDto {
  /** Billed calendar month `YYYY-MM` (same as the utilities sheet). */
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  chargeYearMonth!: string;
}
