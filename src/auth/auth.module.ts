import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { Student } from '../students/entities/student.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { EmailUniquenessModule } from '../common/email-uniqueness/email-uniqueness.module.js';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([Student, Admin, Role]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    EmailUniquenessModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}