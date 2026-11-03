import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { StudentsModule } from './students/students.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { AdminsModule } from './admins/admins.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize:
          configService.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
    }),

    StudentsModule,
    CoursesModule,
    AdminsModule,
    EnrollmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}