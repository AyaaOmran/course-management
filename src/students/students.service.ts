import { Injectable , NotFoundException, ForbiddenException,BadRequestException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Student } from './entities/student.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { Enrollment, EnrollmentStatus} from '../enrollments/entities/enrollment.entity.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { EmailUniquenessService } from '../common/email-uniqueness/email-uniqueness.service.js';
import * as bcrypt from 'bcrypt';

type CurrentUser = {
  sub: number;
  role: 'admin' | 'student';
};
@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly emailUniquenessService: EmailUniquenessService,
    private readonly dataSource: DataSource,
  ){}
  
  findAll() {
    return this.studentRepository.find();
  }

  async findOne(id:number, currentUser: CurrentUser){
    if (currentUser.role === 'student' && currentUser.sub !== id) {
      throw new ForbiddenException('You can only access your own profile');
    }

    const student = await this.studentRepository.findOneBy({id})

    if(!student)
        throw new NotFoundException('student not found!')

    return student

  }

  async create(createStudentDto: CreateStudentDto) {
    await this.emailUniquenessService.assertEmailAvailable(
      createStudentDto.email,
    );

    const studentRole = await this.roleRepository.findOneBy({
      name: 'student',
    });

    if (!studentRole) {
      throw new NotFoundException('Student role not found');
    }

    const hashedPassword = await bcrypt.hash(
      createStudentDto.password,
      10,
    );

    const student = this.studentRepository.create({
      name: createStudentDto.name,
      email: createStudentDto.email,
      phone: createStudentDto.phone,
      password: hashedPassword,
      role: studentRole,
    });

    const savedStudent = await this.studentRepository.save(student);

    return {
      id: savedStudent.id,
      name: savedStudent.name,
      email: savedStudent.email,
      phone: savedStudent.phone,
      createdAt: savedStudent.createdAt,
    };
  }

  async update(id: number, updateStudentDto: UpdateStudentDto,currentUser: CurrentUser) {
    const student = await this.findOne(id, currentUser);

    if (currentUser.role === 'student' && updateStudentDto.email !== undefined){
      throw new BadRequestException(
        'Students cannot update their email',
      );
    }

    if (updateStudentDto.email !== undefined) {
      await this.emailUniquenessService.assertEmailAvailable(
        updateStudentDto.email,
        {
          type: 'student',
          id,
        },
      );
      student.email = updateStudentDto.email;
    }

    if (updateStudentDto.name !== undefined) {
      student.name = updateStudentDto.name;
    }

    if (updateStudentDto.phone !== undefined) {
      student.phone = updateStudentDto.phone;
    }

    const saved = await this.studentRepository.save(student);

    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      phone: saved.phone,
      createdAt: saved.createdAt,
    };
  }

  async remove(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const student = await manager.findOne(Student, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!student) {
        throw new NotFoundException('student not found!');
      }

      await manager.update(
        Enrollment,
        { studentId: id, status: EnrollmentStatus.ACTIVE },
        { status: EnrollmentStatus.CANCELLED },
      );

      
      await manager.softRemove(student);
    });
  }

  async findEnrollments(studentId: number, currentUser: CurrentUser,) {
    await this.findOne(studentId, currentUser);

    const enrollments = await this.enrollmentRepository.find({
      where: { studentId },
      relations: {
        course: true,
      },
      withDeleted: true,
    });

    return enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      course: enrollment.course,
      status: enrollment.status,
      priceAtEnrollment: enrollment.priceAtEnrollment,
      enrolledAt: enrollment.enrolledAt,
    }));
  }

}
