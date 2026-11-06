import {Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus, Req, UseGuards} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Get()
  @Permissions('enrollment:list')
  findAll() {
    return this.enrollmentsService.findAll();
  }

  @Get(':id')
  @Permissions('enrollment:read')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.enrollmentsService.findOne(id, req.user);
  }

  @Post()
  @Permissions('enrollment:create')
  create(
    @Body() createEnrollmentDto: CreateEnrollmentDto,
    @Req() req: any,
  ) {
    return this.enrollmentsService.create(
      createEnrollmentDto,
      req.user,
    );
  }

  @Patch(':id')
  @Permissions('enrollment:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
    @Req() req: any,
  ) {
    return this.enrollmentsService.update(
      id,
      updateEnrollmentDto,
      req.user,
    );
  }

  @Delete(':id')
  @Permissions('enrollment:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.enrollmentsService.remove(id, req.user);
  }
}