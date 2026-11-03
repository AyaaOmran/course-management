import { IsIn } from 'class-validator';
import { EnrollmentStatus } from '../entities/enrollment.entity.js';

export class UpdateEnrollmentDto {
  @IsIn([EnrollmentStatus.CANCELLED])
  status: EnrollmentStatus;
}