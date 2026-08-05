import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  ReservationBoard,
  ReservationListSort,
  ReservationSource,
  ReservationStatus,
  StayBillingPeriod,
} from '@cabin/api-contract';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class ListReservationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;

  @IsOptional()
  @IsEnum(ReservationBoard)
  board?: ReservationBoard;

  @IsOptional()
  @IsEnum(ReservationListSort)
  sort?: ReservationListSort;

  @IsOptional()
  @IsString()
  checkInDate?: string;

  @IsOptional()
  @IsString()
  checkOutDate?: string;

  /** Inclusive stay-touch start YYYY-MM-DD (`to` optional = open-ended). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** Inclusive stay-touch end YYYY-MM-DD (requires `from`). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsEnum(StayBillingPeriod)
  billingPeriod?: (typeof StayBillingPeriod)[keyof typeof StayBillingPeriod];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  hasIcalWarning?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  occupyingOnly?: boolean;
}
