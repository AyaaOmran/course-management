import { DataSource } from 'typeorm';
import { Role } from './roles/entities/role.entity.js';
import { Permission } from './permissions/entities/permission.entity.js';
import { Admin } from './admins/entities/admin.entity.js';
import { Student } from './students/entities/student.entity.js';
import { Course } from './courses/entities/course.entity.js';
import { Enrollment } from './enrollments/entities/enrollment.entity.js';

try {
  process.loadEnvFile();
} catch {
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [Role, Permission, Admin, Student, Course, Enrollment],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
});