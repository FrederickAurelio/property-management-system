import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UnitMonthOccupancyQueryDto {
  /** Calendar month to load, e.g. `2026-07`. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth!: string;

  /** When editing a stay, ignore that reservation in blocks. */
  @IsOptional()
  @IsString()
  excludeReservationId?: string;
}
