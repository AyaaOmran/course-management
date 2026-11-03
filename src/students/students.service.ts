import { Injectable , NotFoundException, ConflictException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Student } from './entities/student.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
  ){}
  
  findAll() {
    return this.studentRepository.find();
  }

  async findOne(id:number){
    const student = await this.studentRepository.findOneBy({id})

    if(!student)
        throw new NotFoundException('student not found!')

    return student

  }

  async create(createStudentDto:CreateStudentDto){
    try{
        const student = this.studentRepository.create(createStudentDto)
        return await this.studentRepository.save(student)
    }catch(error){
        if(error instanceof QueryFailedError && (error as any).driverError?.code === '23505')
            throw new ConflictException('Email already exists')
        throw error;
    }
  }

  async update(id:number , updateStudentDto:UpdateStudentDto){
    const student = await this.findOne(id)
    Object.assign(student,updateStudentDto)
    try{
       return await this.studentRepository.save(student)
    }catch(error){
        if(error instanceof QueryFailedError && (error as any).driverError?.code === '23505')
            throw new ConflictException('email already exist')
        throw error
    }
  }

  async remove(id:number): Promise<void>{
    const student = await this.findOne(id)
    await this.studentRepository.softRemove(student)
  }

  async findEnrollments(studentId: number) {
    const studentExists = await this.studentRepository.existsBy({ id: studentId });
    
    if (!studentExists) {
      throw new NotFoundException('Student not found');
    }

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
