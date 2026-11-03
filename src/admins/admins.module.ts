import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity.js';
import { AdminsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Admin])],
  controllers: [AdminsController],
  providers: [AdminsService]
})
export class AdminsModule {}
