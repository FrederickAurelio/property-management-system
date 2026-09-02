import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import {
  UTILITY_STATEMENT_ACCOUNT_NAME_MAX,
  UTILITY_STATEMENT_ACCOUNT_NUMBER_MAX,
  UTILITY_STATEMENT_BANK_NAME_MAX,
} from '@cabin/api-contract';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Nama Bank / A.N / No. Rek for Cara Pembayaran (PDF F42–F44). */
export class UtilityStatementPayeeDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(UTILITY_STATEMENT_BANK_NAME_MAX)
  bankName!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(UTILITY_STATEMENT_ACCOUNT_NAME_MAX)
  accountName!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(UTILITY_STATEMENT_ACCOUNT_NUMBER_MAX)
  accountNumber!: string;
}
