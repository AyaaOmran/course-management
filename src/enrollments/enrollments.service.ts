import {Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {Enrollment,EnrollmentStatus} from './entities/enrollment.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Course } from '../courses/entities/course.entity.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { discountStrategies } from '../courses/strategies/discount-strategies.map.js';

type CurrentUser = {
  sub: number;
  role: 'admin' | 'student';
};

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,

    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,

    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  findAll() {
    return this.enrollmentRepository.find({
      relations: {
        student: true,
        course: true,
      },
      withDeleted: true,
    });
  }

  async findOne(id: number,currentUser: CurrentUser): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id },
      relations: {
        student: true,
        course: true,
      },
      withDeleted: true,
    });

    if (!enrollment) {
      if (currentUser.role === 'student') {
        throw new ForbiddenException(
          'You cannot access this enrollment',
        );
      }

      throw new NotFoundException('Enrollment not found');
    }

    if (currentUser.role === 'student' && enrollment.studentId !== currentUser.sub) {
      throw new ForbiddenException(
        'You cannot access this enrollment',
      );
    }

    return enrollment;
  }

  async create(createEnrollmentDto: CreateEnrollmentDto,currentUser: CurrentUser) {
    const { courseId, studentId } = createEnrollmentDto;

    let targetStudentId: number;

    if (currentUser.role === 'admin') {
      if (studentId === undefined) {
        throw new BadRequestException(
          'studentId is required for admins',
        );
      }

      targetStudentId = studentId;
    } else {
      if (studentId !== undefined) {
        throw new BadRequestException(
          'Students cannot provide studentId',
        );
      }

      targetStudentId = currentUser.sub;
    }

    const [student, course] = await Promise.all([
      this.studentRepository.findOneBy({
        id: targetStudentId,
      }),
      this.courseRepository.findOneBy({
        id: courseId,
      }),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!course.isActive) {
      throw new BadRequestException(
        'Cannot enroll in an inactive course',
      );
    }

    const existingEnrollment =
      await this.enrollmentRepository.findOneBy({
        studentId: targetStudentId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
      });

    if (existingEnrollment) {
      throw new ConflictException(
        'Student is already enrolled in this course',
      );
    }

    const strategy = discountStrategies[course.discountType];

    const finalPrice = Number(
      strategy
        .calculate(course.price, course.discountValue)
        .toFixed(2),
    );

    const enrollment = this.enrollmentRepository.create({
      studentId: targetStudentId,
      courseId,
      student,
      course,
      priceAtEnrollment: finalPrice,
      status: EnrollmentStatus.ACTIVE,
    });

    return this.enrollmentRepository.save(enrollment);
  }

  async update(id: number,updateEnrollmentDto: UpdateEnrollmentDto,currentUser: CurrentUser) {
    const enrollment = await this.findOne(id, currentUser);

    if (currentUser.role === 'student' && updateEnrollmentDto.status !== EnrollmentStatus.CANCELLED) {
      throw new ForbiddenException(
        'Students can only cancel their own enrollments',
      );
    }

    enrollment.status = updateEnrollmentDto.status;

    return this.enrollmentRepository.save(enrollment);
  }

  async remove(id: number,currentUser: CurrentUser): Promise<void> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'Only admins can delete enrollments',
      );
    }

    const enrollment = await this.findOne(id, currentUser);

    await this.enrollmentRepository.remove(enrollment);
  }
}