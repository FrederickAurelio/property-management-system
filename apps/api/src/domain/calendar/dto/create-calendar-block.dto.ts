import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  CALENDAR_BLOCK_NOTE_MAX,
  CalendarBlockKind,
} from '@cabin/api-contract';

export class CreateCalendarBlockDto {
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @IsEnum(CalendarBlockKind)
  kind!: CalendarBlockKind;

  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(CALENDAR_BLOCK_NOTE_MAX)
  note?: string | null;
}
