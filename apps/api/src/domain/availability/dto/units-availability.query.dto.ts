import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { StayBillingPeriod } from '@cabin/api-contract';

export class UnitsAvailabilityQueryDto {
  /** When omitted with checkOutDate, DATE_OVERLAP is not evaluated. */
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @IsNotEmpty()
  checkInDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @IsNotEmpty()
  checkOutDate?: string;

  /**
   * Candidate stay period — MONTHLY/YEARLY treat proposed busy end as FAR
   * so Choose unit sees conflicts past contract checkout.
   */
  @IsOptional()
  @IsIn(Object.values(StayBillingPeriod))
  billingPeriod?: (typeof StayBillingPeriod)[keyof typeof StayBillingPeriod];

  @IsOptional()
  @IsString()
  unitTypeId?: string;

  /** When editing a stay, ignore that reservation for DATE_OVERLAP. */
  @IsOptional()
  @IsString()
  excludeReservationId?: string;

  /** When editing a calendar block, ignore that block for DATE_OVERLAP. */
  @IsOptional()
  @IsString()
  excludeBlockId?: string;
}
