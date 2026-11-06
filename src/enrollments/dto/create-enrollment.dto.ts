import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateEnrollmentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  studentId?: number;

  @IsInt()
  @Min(1)
  courseId: number;
}