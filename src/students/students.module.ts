import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';
import { Student } from './entities/student.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { EmailUniquenessModule } from '../common/email-uniqueness/email-uniqueness.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Student,Enrollment, Role]),
            EmailUniquenessModule
          ],
  controllers: [StudentsController],
  providers: [StudentsService]
})
export class StudentsModule {}
