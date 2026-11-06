import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../../admins/entities/admin.entity.js';
import { Student } from '../../students/entities/student.entity.js';

type ExcludedAccount = {
  type: 'admin' | 'student';
  id: number;
};

@Injectable()
export class EmailUniquenessService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,

    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
  ) {}

  async assertEmailAvailable(
    email: string,
    exclude?: ExcludedAccount,
  ): Promise<void> {
    const [admin, student] = await Promise.all([
      this.adminRepository.findOneBy({ email }),
      this.studentRepository.findOneBy({ email }),
    ]);

    const adminConflict =
      admin && !(exclude?.type === 'admin' && admin.id === exclude.id);

    const studentConflict =
      student &&
      !(exclude?.type === 'student' && student.id === exclude.id);

    if (adminConflict || studentConflict) {
      throw new ConflictException('Email already exists');
    }
  }
}