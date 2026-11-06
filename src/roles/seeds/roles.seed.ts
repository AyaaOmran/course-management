import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity.js';
import { Permission } from '../../permissions/entities/permission.entity.js';
import { Admin } from '../../admins/entities/admin.entity.js'; // مسار الاستيراد الصحيح
import * as bcrypt from 'bcrypt';

@Injectable()
export class RolesSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,

    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async onModuleInit() {
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
      let permission = await this.permissionRepository.findOneBy({ name });

      if (!permission) {
        permission = this.permissionRepository.create({ name });
        permission = await this.permissionRepository.save(permission);
      }

      allPermissions.push(permission);
    }

    let adminRole = await this.roleRepository.findOneBy({
      name: 'admin',
    });

    if (!adminRole) {
      adminRole = this.roleRepository.create({ name: 'admin' });
    }

    adminRole.permissions = allPermissions;
    await this.roleRepository.save(adminRole);

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

    let studentRole = await this.roleRepository.findOneBy({
      name: 'student',
    });

    if (!studentRole) {
      studentRole = this.roleRepository.create({ name: 'student' });
    }

    studentRole.permissions = studentPermissions;
    await this.roleRepository.save(studentRole);

// ======== زرع أو تحديث الآدمن الافتراضي للاختبارات ========
    const defaultAdminEmail = 'admin@example.com';
    
    // التحقق مما إذا كان الحساب موجوداً مسبقاً
    let defaultAdmin = await this.adminRepository.findOneBy({ email: defaultAdminEmail });
    
    // تشفير كلمة المرور المطلوبة في الاختبار
    const hashedPassword = await bcrypt.hash('admin-pass-1', 10);

    if (!defaultAdmin) {
      // 1. في حال لم يكن موجوداً: ننشئه من الصفر
      defaultAdmin = this.adminRepository.create({
        name: 'Default Admin',
        email: defaultAdminEmail,
        password: hashedPassword,
        role: adminRole, 
      });
      await this.adminRepository.save(defaultAdmin);
      console.log('✅ Default Admin account seeded successfully!');

    } else {
      // 2. في حال كان موجوداً (وهذا هو وضعك الحالي): نُحدّث الباسورد إجبارياً
      defaultAdmin.password = hashedPassword;
      defaultAdmin.role = adminRole; // نضمن ربطه بدور الآدمن
      await this.adminRepository.save(defaultAdmin);
      console.log('🔄 Default Admin account updated with correct hashed password!');
    }
  }
}