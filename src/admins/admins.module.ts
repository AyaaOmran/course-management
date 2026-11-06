import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity.js';
import { AdminsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';
import { Role } from '../roles/entities/role.entity.js';
import { EmailUniquenessModule } from '../common/email-uniqueness/email-uniqueness.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Admin, Role]),
            EmailUniquenessModule,
           ],
  controllers: [AdminsController],
  providers: [AdminsService]
})
export class AdminsModule {}
