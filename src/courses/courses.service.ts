import {Injectable, NotFoundException, BadRequestException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course, DiscountType } from './entities/course.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { discountStrategies } from './strategies/discount-strategies.map.js';

@Injectable()
export class CoursesService {
    constructor(
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Enrollment)
        private readonly enrollmentRepository: Repository<Enrollment>,
    ){}

  private validateDiscount(price: number, discountType: DiscountType, discountValue: number){
    if (price < 0 || discountValue < 0) {
        throw new BadRequestException('Price and discount value cannot be negative');
    }

    if (discountType === DiscountType.PERCENTAGE && discountValue > 100){
        throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    if (discountType === DiscountType.FIXED && discountValue > price){
        throw new BadRequestException('Fixed discount cannot exceed course price');
    }
  }

  private calculateFinalPrice(course: Course): number {
    const strategy = discountStrategies[course.discountType];
    const finalPrice = strategy.calculate(course.price, course.discountValue);
    return Number(finalPrice.toFixed(2));
  }

  private formatCourse(course: Course) {
    return {
      ...course,
      finalPrice: this.calculateFinalPrice(course)
    }
  }  

  async findAll() {
    const courses = await this.courseRepository.find();
    return courses.map((course) => this.formatCourse(course));
  }

  async findOne(id: number) {
    const course = await this.courseRepository.findOneBy({ id });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return this.formatCourse(course);
  }

  async create(createCourseDto: CreateCourseDto) {
    const {price,discountType,discountValue=0} = createCourseDto
    this.validateDiscount(price, discountType, discountValue)

    const courseData = {
      ...createCourseDto,
      discountValue: discountType === DiscountType.NONE ? 0 : discountValue
    };

    const course = this.courseRepository.create(courseData)
    const savedCourse = await this.courseRepository.save(course)

    return this.formatCourse(savedCourse);
  }

  async update(id: number, updateCourseDto: UpdateCourseDto) {
    const course = await this.courseRepository.findOneBy({ id });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    Object.assign(course, updateCourseDto);

    if (course.discountType === DiscountType.NONE) {
      course.discountValue = 0;
    }

    this.validateDiscount(
      course.price,
      course.discountType,
      course.discountValue,
    );

    const updatedCourse = await this.courseRepository.save(course);

    return this.formatCourse(updatedCourse);
  }

  async remove(id: number): Promise<void> {
    const course = await this.findOne(id);
    await this.courseRepository.softRemove(course);
  }

  async findEnrollments(courseId: number) {
      const courseExists = await this.courseRepository.existsBy({ id: courseId });
      
      if (!courseExists) {
        throw new NotFoundException('Course not found');
      }

      const enrollments = await this.enrollmentRepository.find({
        where: { courseId }, 
        relations: {
          student: true, 
        },
      });

      return enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        student: enrollment.student,
        status: enrollment.status,
        priceAtEnrollment: enrollment.priceAtEnrollment,
        enrolledAt: enrollment.enrolledAt,
      }));
    }

}