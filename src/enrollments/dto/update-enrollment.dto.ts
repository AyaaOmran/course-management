import { IsEnum } from 'class-validator';
import { EnrollmentStatus } from '../entities/enrollment.entity.js';

export class UpdateEnrollmentDto {
  @IsEnum(EnrollmentStatus)
  status: EnrollmentStatus;
}