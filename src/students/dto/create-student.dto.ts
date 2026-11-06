import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength
} from 'class-validator';

export class CreateStudentDto{
    @IsString()
    @IsNotEmpty()
    name:string;

    @IsEmail()
    email:string;

    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsString()
    @MinLength(8)
    password: string;
}