import { Injectable , NotFoundException, ConflictException, ForbiddenException,BadRequestException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Student } from './entities/student.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity.js';
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
      role: 'student',
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
    }

    if (currentUser.role === 'student') {
      Object.assign(student, {
        name: updateStudentDto.name,
        phone: updateStudentDto.phone,
      });
    } else {
      Object.assign(student, updateStudentDto);
    }
    const updatedStudent = await this.studentRepository.save(student);
        
        // 2. احذفي الأسرار من النسخة المُرجعة (نستخدم as any لتجنب اعتراض TypeScript)
        delete (updatedStudent as any).password;
        delete (updatedStudent as any).refreshToken;
        
        // 3. أرجعي النتيجة النظيفة للـ Controller
        return updatedStudent;
  }

  async remove(id:number,currentUser: CurrentUser): Promise<void>{
    const student = await this.findOne(id,currentUser)
    await this.studentRepository.softRemove(student)
  }

  async findEnrollments(studentId: number, currentUser: CurrentUser,) {
    await this.findOne(studentId, currentUser);

    const enrollments = await this.enrollmentRepository.find({
      where: { studentId },
      relations: {
        course: true,
      },
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
