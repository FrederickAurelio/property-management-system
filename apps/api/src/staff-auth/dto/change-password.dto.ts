import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { STAFF_PASSWORD_MAX, STAFF_PASSWORD_MIN } from '@cabin/api-contract';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(STAFF_PASSWORD_MIN)
  @MaxLength(STAFF_PASSWORD_MAX)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(STAFF_PASSWORD_MIN)
  @MaxLength(STAFF_PASSWORD_MAX)
  newPassword!: string;
}
