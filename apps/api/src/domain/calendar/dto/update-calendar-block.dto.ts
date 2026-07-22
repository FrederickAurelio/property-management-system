import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  CALENDAR_BLOCK_NOTE_MAX,
  CalendarBlockKind,
} from '@cabin/api-contract';

export class UpdateCalendarBlockDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsEnum(CalendarBlockKind)
  kind?: CalendarBlockKind;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(CALENDAR_BLOCK_NOTE_MAX)
  note?: string | null;
}
