import {Injectable, NotFoundException, BadRequestException, ConflictException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment, EnrollmentStatus } from './entities/enrollment.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Course } from '../courses/entities/course.entity.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { discountStrategies } from '../courses/strategies/discount-strategies.map.js';

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

  async findOne(id: number): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id },
      relations: {
        student: true,
        course: true,
      },
      withDeleted: true,
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    return enrollment;
  }

  async create(createEnrollmentDto: CreateEnrollmentDto) {
    const { studentId, courseId } = createEnrollmentDto;

    const [student, course] = await Promise.all([
          this.studentRepository.findOneBy({ id: studentId }),
          this.courseRepository.findOneBy({ id: courseId }),
        ]);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!course.isActive) {
      throw new BadRequestException('Cannot enroll in an inactive course');
    }

    const existingEnrollment = await this.enrollmentRepository.findOneBy({
        studentId,
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
      strategy.calculate(course.price, course.discountValue).toFixed(2),
    );

    const enrollment = this.enrollmentRepository.create({
      studentId,
      courseId,
      student,
      course,
      priceAtEnrollment: finalPrice,
      status: EnrollmentStatus.ACTIVE,
    });

    return this.enrollmentRepository.save(enrollment);
  }

  async update(id: number, updateEnrollmentDto: UpdateEnrollmentDto) {
    const enrollment = await this.findOne(id);

    if (updateEnrollmentDto.status !== EnrollmentStatus.CANCELLED) {
      throw new BadRequestException('Only cancellation is allowed');
    }

    Object.assign(enrollment, updateEnrollmentDto);

    return this.enrollmentRepository.save(enrollment);
  }

    async remove(id: number): Promise<void> {
    const enrollment = await this.findOne(id);

    await this.enrollmentRepository.remove(enrollment);
    }
}

