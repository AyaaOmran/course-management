import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../entities/role.entity.js';
import { Permission } from '../../permissions/entities/permission.entity.js';

@Injectable()
export class RolesSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async onModuleInit(): Promise<void> {
    const permissionNames = [
      'course:create',
      'course:read',
      'course:update',
      'course:delete',
      'student:create',
      'student:list',
      'student:read',
      'student:update',
      'student:delete',
      'admin:create',
      'admin:read',
      'admin:update',
      'admin:delete',
      'enrollment:create',
      'enrollment:list',
      'enrollment:read',
      'enrollment:update',
      'enrollment:delete',
    ];

    const allPermissions: Permission[] = [];

    for (const name of permissionNames) {
      let permission = await this.permissionRepository.findOneBy({
        name,
      });

      if (!permission) {
        permission = this.permissionRepository.create({ name });
        permission = await this.permissionRepository.save(permission);
      }

      allPermissions.push(permission);
    }

    const adminRole = await this.createOrUpdateRole(
      'admin',
      allPermissions,
    );

    const studentPermissionNames = [
      'course:read',
      'student:read',
      'student:update',
      'enrollment:create',
      'enrollment:read',
      'enrollment:update',
    ];

    const studentPermissions = allPermissions.filter((permission) =>
      studentPermissionNames.includes(permission.name),
    );

    await this.createOrUpdateRole('student', studentPermissions);
  }

  private async createOrUpdateRole(
    name: string,
    permissions: Permission[],
  ): Promise<Role> {
    let role = await this.roleRepository.findOne({
      where: { name },
      relations: { permissions: true },
    });

    if (!role) {
      role = this.roleRepository.create({ name });
    }

    role.permissions = permissions;

    return this.roleRepository.save(role);
  }
}