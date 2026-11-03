import {Injectable, NotFoundException, ConflictException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError} from 'typeorm';
import { Admin } from './entities/admin.entity.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateAdminDto } from './dto/update-admin.dto.js';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
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
    try{
        const admin = this.adminRepository.create(createAdminDto);
        return await this.adminRepository.save(admin);
    }catch(error){
        if(error instanceof QueryFailedError && (error as any).driverError?.code === '23505')
            throw new ConflictException('Email already exists')
        throw error;
    }
  }

  async update(id: number, updateAdminDto: UpdateAdminDto) {
    const admin = await this.findOne(id);
    Object.assign(admin, updateAdminDto);
    try{
        return await this.adminRepository.save(admin);
    }catch(error){
        if(error instanceof QueryFailedError && (error as any).driverError?.code === '23505')
            throw new ConflictException('email already exist')
        throw error
    }
  }

  async remove(id: number): Promise<void> {
    const admin = await this.findOne(id);
    await this.adminRepository.remove(admin);
  }
}
