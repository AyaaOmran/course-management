import * as bcrypt from 'bcrypt';
import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';

import dataSource from '../data-source.js';
import { Role } from '../roles/entities/role.entity.js';
import { Permission } from '../permissions/entities/permission.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Course, DiscountType } from '../courses/entities/course.entity.js';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity.js';
import {
  PERMISSION_NAMES,
  STUDENT_PERMISSION_NAMES,
} from './roles-permissions.data.js';

const ROLE_NAMES = ['admin', 'student'];


const SAMPLE_STUDENT_PASSWORD = 'student-pass-1';

const SAMPLE_STUDENTS = [
  { name: 'Sara Mohammad', email: 'sara@example.com', phone: '+33123456789' },
  { name: 'Omar Khaled', email: 'omar@example.com', phone: '+33123456790' },
  { name: 'Lina Hassan', email: 'lina@example.com', phone: '+33123456791' },
];

const SAMPLE_COURSES = [
  {
    title: 'NestJS Basics',
    description: 'Learn the fundamentals of NestJS',
    price: 100,
    discountType: DiscountType.NONE,
    discountValue: 0,
    isActive: true,
  },
  {
    title: 'TypeORM Deep Dive',
    description: 'Entities, relations, migrations and transactions',
    price: 200,
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    isActive: true,
  },
  {
    title: 'Database Design',
    description: 'Modeling, indexes and normalization',
    price: 150,
    discountType: DiscountType.FIXED,
    discountValue: 30,
    isActive: true,
  },
  {
    title: 'Legacy PHP (archived)',
    description: 'No longer offered',
    price: 80,
    discountType: DiscountType.NONE,
    discountValue: 0,
    isActive: false,
  },
];


const SAMPLE_ENROLLMENTS = [
  {
    studentEmail: 'sara@example.com',
    courseTitle: 'NestJS Basics',
    status: EnrollmentStatus.ACTIVE,
    priceAtEnrollment: 100,
  },
  {
    studentEmail: 'sara@example.com',
    courseTitle: 'Database Design',
    status: EnrollmentStatus.ACTIVE,
    priceAtEnrollment: 120,
  },
  {
    studentEmail: 'omar@example.com',
    courseTitle: 'TypeORM Deep Dive',
    status: EnrollmentStatus.CANCELLED,
    priceAtEnrollment: 160,
  },

  {
    studentEmail: 'lina@example.com',
    courseTitle: 'Legacy PHP (archived)',
    status: EnrollmentStatus.ACTIVE,
    priceAtEnrollment: 80,
  },
];


async function seedRolesAndPermissions(manager: EntityManager) {
  const roleRepo = manager.getRepository(Role);
  const permissionRepo = manager.getRepository(Permission);


  const existingRoles = await roleRepo.find({
    where: { name: In(ROLE_NAMES) },
  });
  const missingRoles = ROLE_NAMES.filter(
    (name) => !existingRoles.some((r) => r.name === name),
  );
  if (missingRoles.length > 0) {
    await roleRepo.save(missingRoles.map((name) => roleRepo.create({ name })));
  }


  const existingPermissions = await permissionRepo.find({
    where: { name: In(PERMISSION_NAMES) },
  });
  const missingPermissions = PERMISSION_NAMES.filter(
    (name) => !existingPermissions.some((p) => p.name === name),
  );
  if (missingPermissions.length > 0) {
    await permissionRepo.save(
      missingPermissions.map((name) => permissionRepo.create({ name })),
    );
  }


  const roles = await roleRepo.find({
    where: { name: In(ROLE_NAMES) },
    relations: { permissions: true },
  });
  const permissions = await permissionRepo.find({
    where: { name: In(PERMISSION_NAMES) },
  });

  for (const role of roles) {
    role.permissions =
      role.name === 'admin'
        ? permissions
        : permissions.filter((p) => STUDENT_PERMISSION_NAMES.includes(p.name));
    await roleRepo.save(role);
  }

  return {
    adminRole: roles.find((r) => r.name === 'admin')!,
    studentRole: roles.find((r) => r.name === 'student')!,
  };
}



async function seedAdmin(manager: EntityManager, adminRole: Role) {
  const email = process.env.DEFAULT_ADMIN_EMAIL;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be set in .env',
    );
  }
  if (password.length < 8) {
    throw new Error('DEFAULT_ADMIN_PASSWORD must be at least 8 characters');
  }

  const adminRepo = manager.getRepository(Admin);

  if (await adminRepo.existsBy({ email })) {
    console.log(`Admin ${email} already exists, skipping`);
    return;
  }


  const usedByStudent = await manager
    .getRepository(Student)
    .exists({ where: { email }, withDeleted: true });
  if (usedByStudent) {
    throw new Error(`DEFAULT_ADMIN_EMAIL ${email} already belongs to a student`);
  }

  await adminRepo.save(
    adminRepo.create({
      name: 'Default Admin',
      email,
      password: await bcrypt.hash(password, 10),
      role: adminRole,
    }),
  );
  console.log(`Admin ${email} created`);
}



async function seedStudents(manager: EntityManager, studentRole: Role) {
  const repo = manager.getRepository(Student);
  const students = new Map<string, Student>();

  for (const sample of SAMPLE_STUDENTS) {
    let student = await repo.findOne({
      where: { email: sample.email },
      withDeleted: true,
    });

    if (!student) {
      student = await repo.save(
        repo.create({
          ...sample,
          password: await bcrypt.hash(SAMPLE_STUDENT_PASSWORD, 10),
          role: studentRole,
        }),
      );
      console.log(`Student ${sample.email} created`);
    }

    students.set(sample.email, student);
  }

  return students;
}



async function seedCourses(manager: EntityManager) {
  const repo = manager.getRepository(Course);
  const courses = new Map<string, Course>();

  for (const sample of SAMPLE_COURSES) {
    let course = await repo.findOne({
      where: { title: sample.title },
      withDeleted: true,
    });

    if (!course) {
      course = await repo.save(repo.create(sample));
      console.log(`Course "${sample.title}" created`);
    }

    courses.set(sample.title, course);
  }

  return courses;
}



async function seedEnrollments(
  manager: EntityManager,
  students: Map<string, Student>,
  courses: Map<string, Course>,
) {
  const repo = manager.getRepository(Enrollment);

  for (const sample of SAMPLE_ENROLLMENTS) {
    const student = students.get(sample.studentEmail)!;
    const course = courses.get(sample.courseTitle)!;


    if (!course.isActive) {
      console.log(
        `Enrollment blocked: "${course.title}" is not active (${student.email})`,
      );
      continue;
    }

    const exists = await repo.existsBy({
      studentId: student.id,
      courseId: course.id,
      status: sample.status,
    });
    if (exists) {
      continue;
    }

    await repo.save(
      repo.create({
        studentId: student.id,
        courseId: course.id,
        status: sample.status,
        priceAtEnrollment: sample.priceAtEnrollment,
      }),
    );
    console.log(
      `Enrollment created: ${student.email} -> "${course.title}" (${sample.status})`,
    );
  }
}



async function main() {
  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const { adminRole, studentRole } = await seedRolesAndPermissions(manager);
      await seedAdmin(manager, adminRole);

      if (process.env.NODE_ENV === 'production') {
        console.log('NODE_ENV=production: skipping sample data');
        return;
      }

      const students = await seedStudents(manager, studentRole);
      const courses = await seedCourses(manager);
      await seedEnrollments(manager, students, courses);
    });
    console.log('Seed completed');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});