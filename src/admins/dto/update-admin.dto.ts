import {IsString, IsNotEmpty, IsEmail, IsOptional} from 'class-validator';

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}