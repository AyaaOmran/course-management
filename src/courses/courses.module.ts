import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { Course } from './entities/course.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Course,Enrollment])],
  controllers: [CoursesController],
  providers: [CoursesService]
})
export class CoursesModule {}
