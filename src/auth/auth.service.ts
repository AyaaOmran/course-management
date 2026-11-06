import {Injectable,InternalServerErrorException,UnauthorizedException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { Student } from '../students/entities/student.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ConfigService } from '@nestjs/config';
import { EmailUniquenessService } from '../common/email-uniqueness/email-uniqueness.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(Student)
        private readonly studentRepository: Repository<Student>,

        @InjectRepository(Admin)
        private readonly adminRepository: Repository<Admin>,

        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,

        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly emailUniquenessService: EmailUniquenessService,
    ) {}

    async register(registerDto: RegisterDto) {
        const { name, email, phone, password } = registerDto;

        await this.emailUniquenessService.assertEmailAvailable(email);

        const studentRole = await this.roleRepository.findOne({
            where: { name: 'student' },
        });

        if (!studentRole) {
            throw new InternalServerErrorException('Student role not found');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const student = this.studentRepository.create({
            name,
            email,
            phone,
            password: hashedPassword,
            role: studentRole,
        });

        const savedStudent = await this.studentRepository.save(student);

        return {
            id: savedStudent.id,
            name: savedStudent.name,
            email: savedStudent.email,
            phone: savedStudent.phone,
            role: studentRole.name,
        };
    }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        const admin = await this.adminRepository
            .createQueryBuilder('admin')
            .addSelect('admin.password')
            .leftJoinAndSelect('admin.role', 'role')
            .leftJoinAndSelect('role.permissions', 'permissions')
            .where('admin.email = :email', { email })
            .getOne();

        const student = admin
            ? null
            : await this.studentRepository
                .createQueryBuilder('student')
                .addSelect('student.password')
                .leftJoinAndSelect('student.role', 'role')
                .leftJoinAndSelect('role.permissions', 'permissions')
                .where('student.email = :email', { email })
                .getOne();

        const account = admin ?? student;

        if (!account) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!account.role) {
        throw new InternalServerErrorException('Account role not found');
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            account.password,
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const permissions = account.role.permissions.map(
        (permission) => permission.name,
        );

        const payload = {
        sub: account.id,
        email: account.email,
        role: account.role.name,
        permissions,
        };

        const accessToken = await this.jwtService.signAsync(payload, {
        expiresIn: '15m',
        });

        const refreshToken = await this.jwtService.signAsync(
        {
            sub: account.id,
            email: account.email,
            role: account.role.name,
            accountType: admin ? 'admin' : 'student',
            tokenType: 'refresh',
        },
        {
            expiresIn: '7d',
            secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
        );

        const refreshHash = createHash('sha256')
            .update(refreshToken)
            .digest('hex');

        if (admin) {
            await this.adminRepository.update(account.id, { refreshToken: refreshHash });
        } else if (student) {
            await this.studentRepository.update(account.id, { refreshToken: refreshHash });
        }

        return {
            accessToken,
            refreshToken, 
            user: {
                id: account.id,
                name: account.name,
                email: account.email,
                role: account.role.name,
                permissions,
            },
        };

    }

    async refresh(refreshDto: RefreshDto) {
        const { refreshToken } = refreshDto;
        let payload;

        try {
            payload = await this.jwtService.verifyAsync(refreshToken, {
            secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET')});
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (
            payload.tokenType !== 'refresh' ||
            !['admin', 'student'].includes(payload.accountType)
        ) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const isAdmin = payload.accountType === 'admin';

        const account = isAdmin
            ? await this.adminRepository
                .createQueryBuilder('admin')
                .addSelect('admin.refreshToken')
                .leftJoinAndSelect('admin.role', 'role')
                .leftJoinAndSelect('role.permissions', 'permissions')
                .where('admin.id = :id', { id: payload.sub })
                .andWhere('admin.email = :email', { email: payload.email })
                .getOne()
            : await this.studentRepository
                .createQueryBuilder('student')
                .addSelect('student.refreshToken')
                .leftJoinAndSelect('student.role', 'role')
                .leftJoinAndSelect('role.permissions', 'permissions')
                .where('student.id = :id', { id: payload.sub })
                .andWhere('student.email = :email', { email: payload.email })
                .getOne();

        if (!account || !account.refreshToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const incomingHash = createHash('sha256')
            .update(refreshToken)
            .digest('hex');

        if (incomingHash !== account.refreshToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (!account.role) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const permissions = account.role.permissions.map(
            (permission) => permission.name,
        );

        const accessPayload = {
            sub: account.id,
            email: account.email,
            role: account.role.name,
            permissions,
        };

        const accessToken = await this.jwtService.signAsync(
            accessPayload,
            {   expiresIn: '15m' ,
                secret: this.configService.getOrThrow<string>('JWT_SECRET')
            });

        return { accessToken };
    }    

    async logout(user: { sub: number; role: string }) {
        if (user.role === 'admin') {
            await this.adminRepository.update(
            user.sub,
            { refreshToken: null },
            );
        } else if (user.role === 'student') {
            await this.studentRepository.update(
            user.sub,
            { refreshToken: null },
            );
        } else {
            throw new UnauthorizedException('Invalid user');
        }
    }

}