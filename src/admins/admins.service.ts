import {Injectable,NotFoundException,ConflictException,ForbiddenException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './entities/admin.entity.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateAdminDto } from './dto/update-admin.dto.js';
import { Student } from '../students/entities/student.entity.js';
import { EmailUniquenessService } from '../common/email-uniqueness/email-uniqueness.service.js';
import { Role } from '../roles/entities/role.entity.js';
import * as bcrypt from 'bcrypt';

type CurrentUser = {
  sub: number;
  role: 'admin' | 'student';
};
@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly emailUniquenessService: EmailUniquenessService,
  ) {}

  findAll() {
    return this.adminRepository.find();
  }

  async findOne(id: number) {
    const admin = await this.adminRepository.findOneBy({ id });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async create(createAdminDto: CreateAdminDto) {
    await this.emailUniquenessService.assertEmailAvailable(
    createAdminDto.email,
    );

    const adminRole = await this.roleRepository.findOneBy({
      name: 'admin',
    });

    if (!adminRole) {
      throw new NotFoundException('Admin role not found');
    }

    const hashedPassword = await bcrypt.hash(
      createAdminDto.password,
      10,
    );

    const admin = this.adminRepository.create({
      name: createAdminDto.name,
      email: createAdminDto.email,
      password: hashedPassword,
      role: adminRole,
    });

    const savedAdmin = await this.adminRepository.save(admin);

    return {
      id: savedAdmin.id,
      name: savedAdmin.name,
      email: savedAdmin.email,
      role: 'admin',
      createdAt: savedAdmin.createdAt,
    };
  }

  async update(id: number, updateAdminDto: UpdateAdminDto) {
    const admin = await this.findOne(id);

    if (updateAdminDto.email !== undefined) {
      await this.emailUniquenessService.assertEmailAvailable(
        updateAdminDto.email,
        {
          type: 'admin',
          id,
        },
      );
    }

    if (updateAdminDto.name !== undefined) {
      admin.name = updateAdminDto.name;
    }

    if (updateAdminDto.email !== undefined) {
      admin.email = updateAdminDto.email;
    }

    const updatedAdmin = await this.adminRepository.save(admin);

    return {
      id: updatedAdmin.id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      role: 'admin',
      createdAt: updatedAdmin.createdAt,
    };
  }

  async remove(id: number, currentUser: CurrentUser): Promise<void> {
    if (currentUser.sub === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const admin = await this.findOne(id);

    await this.adminRepository.remove(admin);
  }
}
