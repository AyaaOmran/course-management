import {IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsBoolean, IsOptional} from 'class-validator';
import { DiscountType } from '../entities/course.entity.js';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}