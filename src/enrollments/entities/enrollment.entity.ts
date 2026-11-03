import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn} from 'typeorm';
import type { Relation } from 'typeorm';
import { Student } from '../../students/entities/student.entity.js';
import { Course } from '../../courses/entities/course.entity.js';


export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @ManyToOne(() => Student, (student) => student.enrollments)
  @JoinColumn({ name: 'studentId' })
  student: Relation<Student>;

  @Column()
  courseId: number;

  @ManyToOne(() => Course, (course) => course.enrollments)
  @JoinColumn({ name: 'courseId' })
  course: Relation<Course>;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  priceAtEnrollment: number;

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.ACTIVE,
  })
  status: EnrollmentStatus;

  @CreateDateColumn()
  enrolledAt: Date;
}