import {Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
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

  private toResponse(enrollment: Enrollment) {
      return {
        id: enrollment.id,
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        priceAtEnrollment: enrollment.priceAtEnrollment,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      };
  }

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
      priceAtEnrollment: finalPrice,
      status: EnrollmentStatus.ACTIVE,
    });

    const saved = await this.enrollmentRepository.save(enrollment);

    return this.toResponse(saved);
  }

  async update(id: number,updateEnrollmentDto: UpdateEnrollmentDto,currentUser: CurrentUser) {
    const enrollment = await this.findOne(id, currentUser);

    if (currentUser.role === 'student' && updateEnrollmentDto.status !== EnrollmentStatus.CANCELLED) {
      throw new ForbiddenException('Students can only cancel their own enrollments');
    }

    const newStatus = updateEnrollmentDto.status;

    if (newStatus === EnrollmentStatus.ACTIVE && enrollment.status !== EnrollmentStatus.ACTIVE) {
      const duplicate = await this.enrollmentRepository.existsBy({
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        status: EnrollmentStatus.ACTIVE,
        id: Not(enrollment.id),
      });

      if (duplicate) {
        throw new ConflictException('Student already has an active enrollment in this course');
      }
    }

    enrollment.status = newStatus;

    const saved = await this.enrollmentRepository.save(enrollment);
    return this.toResponse(saved);
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