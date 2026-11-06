import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../../admins/entities/admin.entity.js';
import { Student } from '../../students/entities/student.entity.js';
import { EmailUniquenessService } from './email-uniqueness.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Admin, Student])],
  providers: [EmailUniquenessService],
  exports: [EmailUniquenessService],
})
export class EmailUniquenessModule {}