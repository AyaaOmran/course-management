import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Admin } from '../../admins/entities/admin.entity.js';
import { Role } from '../entities/role.entity.js';

@Injectable()
export class DefaultAdminSeeder implements OnModuleInit {
  private readonly logger = new Logger(DefaultAdminSeeder.name);

  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async onModuleInit(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const shouldSeedAdmin =
      this.configService.get<string>('SEED_DEFAULT_ADMIN') === 'true';

    if (
      nodeEnv !== 'development' &&
      nodeEnv !== 'test'
    ) {
      return;
    }

    if (!shouldSeedAdmin) {
      return;
    }

    const email = this.configService.get<string>('DEFAULT_ADMIN_EMAIL');
    const password = this.configService.get<string>('DEFAULT_ADMIN_PASSWORD');

    if (!email || !password) {
      throw new Error(
        'DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be configured.',
      );
    }

    const existingAdmin = await this.adminRepository.findOneBy({
      email,
    });

    if (existingAdmin) {
      this.logger.log('Default admin already exists. Skipping creation.');
      return;
    }

    const adminRole = await this.roleRepository.findOneBy({
      name: 'admin',
    });

    if (!adminRole) {
      throw new Error('Admin role was not found. Run RolesSeeder first.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const defaultAdmin = this.adminRepository.create({
      name: 'Default Admin',
      email,
      password: hashedPassword,
      role: adminRole,
    });

    await this.adminRepository.save(defaultAdmin);

    this.logger.log('Default admin created successfully.');
  }
}