import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Role } from './entities/role.entity.js';
import { Permission } from '../permissions/entities/permission.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';

import { RolesSeeder } from './seeds/roles.seed.js';
import { DefaultAdminSeeder } from './seeds/default-admin.seed.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, Admin]),
  ],
  providers: [
    RolesSeeder,
    DefaultAdminSeeder,
  ],
})
export class RolesModule {}