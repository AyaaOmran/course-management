import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';
import { Student } from './entities/student.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Student,Enrollment])],
  controllers: [StudentsController],
  providers: [StudentsService]
})
export class StudentsModule {}
