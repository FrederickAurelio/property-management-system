import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  UTILITY_ADDON_CONSTANT_IDR_MAX,
  UTILITY_ADDON_NAME_MAX,
  UTILITY_ADDON_PERCENT_MAX,
  UtilityAddonKind,
  UtilityKind,
} from '@cabin/api-contract';

@ValidatorConstraint({ name: 'utilityAddonValueByKind', async: false })
class UtilityAddonValueByKindConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return true;
    }
    const kind = (args.object as UtilityAddonInputDto).kind;
    if (kind === UtilityAddonKind.PERCENT) {
      return value <= UTILITY_ADDON_PERCENT_MAX;
    }
    if (kind === UtilityAddonKind.CONSTANT) {
      return value <= UTILITY_ADDON_CONSTANT_IDR_MAX;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const kind = (args.object as UtilityAddonInputDto).kind;
    if (kind === UtilityAddonKind.PERCENT) {
      return `value must not exceed ${UTILITY_ADDON_PERCENT_MAX} for PERCENT add-ons`;
    }
    return `value must not exceed ${UTILITY_ADDON_CONSTANT_IDR_MAX} for CONSTANT add-ons`;
  }
}

export class UtilityAddonInputDto {
  @IsEnum(UtilityKind)
  utility!: UtilityKind;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(UTILITY_ADDON_NAME_MAX)
  name!: string;

  @IsEnum(UtilityAddonKind)
  kind!: UtilityAddonKind;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Validate(UtilityAddonValueByKindConstraint)
  @Max(UTILITY_ADDON_CONSTANT_IDR_MAX)
  value!: number;

  /**
   * Optional. If omitted, the service assigns 0,1,2… independently per
   * `utility` in array appearance order (ELECTRICITY 0..n, WATER 0..n).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
