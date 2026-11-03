import { IsString,IsNotEmpty,IsEmail } from "class-validator";

export class CreateAdminDto{
    @IsString()
    @IsNotEmpty()
    name:string

    @IsEmail()
    email:string
}