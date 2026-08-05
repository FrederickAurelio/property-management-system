import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Busy intervals for date-picker blocking.
 * Pass either `yearMonth` (one month + spill) or both `from`+`to` (half-open range).
 * `from` without `to` (or the reverse) is rejected — do not mix a lone side with `yearMonth`.
 */
export class UnitMonthOccupancyQueryDto {
  /** Calendar month to load, e.g. `2026-07` (legacy single-month). */
  @ValidateIf((o: UnitMonthOccupancyQueryDto) => !o.from && !o.to)
  @IsString()
  @IsNotEmpty()
  @Matches(YEAR_MONTH)
  yearMonth?: string;

  /** Inclusive range start YYYY-MM-DD (requires `to`). */
  @ValidateIf(
    (o: UnitMonthOccupancyQueryDto) =>
      Boolean(o.from) || Boolean(o.to) || !o.yearMonth,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(YMD)
  from?: string;

  /** Exclusive range end YYYY-MM-DD (requires `from`). */
  @ValidateIf(
    (o: UnitMonthOccupancyQueryDto) =>
      Boolean(o.from) || Boolean(o.to) || !o.yearMonth,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(YMD)
  to?: string;

  /** When editing a stay, ignore that reservation in blocks. */
  @IsOptional()
  @IsString()
  excludeReservationId?: string;
}
