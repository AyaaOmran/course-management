import {
  IsString,
  IsEmail,
  IsNotEmpty,
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
}