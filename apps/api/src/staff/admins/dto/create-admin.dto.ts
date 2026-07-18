import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AdminRole,
  STAFF_PASSWORD_MAX,
  STAFF_PASSWORD_MIN,
  STAFF_USERNAME_MAX,
  STAFF_USERNAME_MIN,
  STAFF_USERNAME_PATTERN,
} from '@cabin/api-contract';

export class CreateAdminDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(STAFF_USERNAME_MIN)
  @MaxLength(STAFF_USERNAME_MAX)
  @Matches(STAFF_USERNAME_PATTERN, {
    message:
      'Username may only contain letters, numbers, dots, hyphens, or underscores',
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(STAFF_PASSWORD_MIN)
  @MaxLength(STAFF_PASSWORD_MAX)
  password!: string;

  @IsEnum(AdminRole)
  role!: AdminRole;

  @IsString()
  @IsNotEmpty()
  @MinLength(STAFF_PASSWORD_MIN)
  @MaxLength(STAFF_PASSWORD_MAX)
  currentPassword!: string;
}
