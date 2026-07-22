import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class PropertyCalendarQueryDto {
  /** Inclusive range start YYYY-MM-DD (property-local). */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  /** Exclusive range end YYYY-MM-DD (property-local). */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}
