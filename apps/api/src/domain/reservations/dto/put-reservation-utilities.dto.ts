import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX,
  UNIT_TYPE_UTILITY_RATE_IDR_MAX,
  UTILITY_METER_FRACTION_DIGITS,
  UTILITY_METER_VALUE_MAX,
  UtilityKind,
} from '@cabin/api-contract';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class UtilityReadingInputDto {
  @IsEnum(UtilityKind)
  utility!: (typeof UtilityKind)[keyof typeof UtilityKind];

  @IsString()
  @Matches(YMD)
  readingDate!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: UTILITY_METER_FRACTION_DIGITS },
    {
      message: `meterValue allows at most ${UTILITY_METER_FRACTION_DIGITS} decimal places`,
    },
  )
  @Min(0)
  @Max(UTILITY_METER_VALUE_MAX)
  meterValue!: number;
}

export class MaintenanceChargeInputDto {
  @IsString()
  @Matches(YMD)
  chargeDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX)
  amountIdr!: number;
}

/** PUT /staff/reservations/:id/utilities — replace-set readings + maintenance. */
export class PutReservationUtilitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_UTILITY_RATE_IDR_MAX)
  electricityRateIdrPerKwh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_UTILITY_RATE_IDR_MAX)
  waterRateIdrPerM3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX)
  maintenanceFeeIdrPerMonth?: number;

  @IsArray()
  @ArrayMaxSize(240)
  @ValidateNested({ each: true })
  @Type(() => UtilityReadingInputDto)
  electricityReadings!: UtilityReadingInputDto[];

  @IsArray()
  @ArrayMaxSize(240)
  @ValidateNested({ each: true })
  @Type(() => UtilityReadingInputDto)
  waterReadings!: UtilityReadingInputDto[];

  @IsArray()
  @ArrayMaxSize(240)
  @ValidateNested({ each: true })
  @Type(() => MaintenanceChargeInputDto)
  maintenanceCharges!: MaintenanceChargeInputDto[];
}
