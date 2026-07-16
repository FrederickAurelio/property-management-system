import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
