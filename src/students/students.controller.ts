import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe,HttpCode, HttpStatus, Req} from '@nestjs/common';
import { StudentsService } from './students.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
  ) {}

  @Permissions('student:list')
  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Permissions('student:read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number,@Req() req: any) {
    return this.studentsService.findOne(id, req.user);
  }

  @Permissions('student:create')
  @Post()
  create(@Body() createStudentDto : CreateStudentDto){
    return this.studentsService.create(createStudentDto);
  }

  @Permissions('student:update')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudentDto: UpdateStudentDto,
    @Req() req: any
  ) {
    return this.studentsService.update(id, updateStudentDto, req.user);
  }

  @Permissions('student:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.remove(id);
  }

  @Permissions('enrollment:read')
  @Get(':id/enrollments')
  findEnrollments(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.studentsService.findEnrollments(id, req.user);
  }

}