import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AdminRole,
  STAFF_PASSWORD_MAX,
  STAFF_PASSWORD_MIN,
} from '@cabin/api-contract';

export class ChangeAdminRoleDto {
  @IsEnum(AdminRole)
  role!: AdminRole;

  @IsString()
  @IsNotEmpty()
  @MinLength(STAFF_PASSWORD_MIN)
  @MaxLength(STAFF_PASSWORD_MAX)
  currentPassword!: string;
}
