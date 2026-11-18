# Course Management API

A RESTful API for managing courses, students, admins, and enrollments, built with **NestJS**, **TypeORM**, and **PostgreSQL**.

The API includes JWT authentication, role-based permissions, and database operations protected by migrations and transactions.

## Tech Stack

- **NestJS** – Backend framework
- **TypeScript** – Programming language
- **TypeORM** – ORM and database migrations
- **PostgreSQL** – Relational database
- **JWT** – Authentication
- **class-validator** – Request validation
- **Vitest** – Testing

## Features

- Admin and student authentication.
- Access and refresh token handling.
- Role and permission-based authorization.
- Student management.
- Admin management.
- Course management with NONE, PERCENTAGE, and FIXED discounts.
- Enrollment management and status tracking.
- Student ownership restrictions.
- Soft deletion for students and courses.

## Project Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, you can use:

   ```powershell
   Copy-Item .env.example .env
   ```

   Required variables: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`,
   `DB_DATABASE`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and
   `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` (used by the seed script;
   the password must be at least 8 characters).

3. Create an empty PostgreSQL database matching `DB_DATABASE`, then build the
   schema and seed it:

   ```bash
   npm run migration:run
   npm run seed
   ```

4. Start the API (see "Running the Project" below).

## Running the Project

Run in development mode:

```bash
npm run start:dev
```

Build the project:

```bash
npm run build
```

Run the compiled application:

```bash
npm run start:prod
```


## Database Layer

The database schema is managed **only by migrations**. TypeORM `synchronize` is disabled, so schema changes must be applied through migration files.

Migrations and the seed script run from the compiled output. Their npm scripts build the project before execution.

### Migrations

| Command | What it does |
|---|---|
| `npm run migration:run` | Runs all pending migrations |
| `npm run migration:revert` | Rolls back the last migration only (run it repeatedly to roll back further) |
| `npm run migration:show` | Lists executed and pending migrations |
| `npm run migration:generate -- src/migrations/Name` | Generates a migration from entity changes |

Migration files are organized into logical groups and executed in dependency order:

1. `CreateRolesAndPermissions`: creates `roles`, `permissions`, and the `role_permissions` join table.
2. `CreateAdmins`: creates `admins`, including its foreign key to `roles`.
3. `CreateStudents`: creates `students`, including its foreign key to `roles`.
4. `CreateCourses`: creates `courses`.
5. `CreateEnrollments`: creates `enrollments`, its foreign keys to `students` and `courses`, and its indexes.

Each migration contains an `up` method to apply the changes and a `down` method to reverse them.

#### Rebuild the database from scratch

Create an empty PostgreSQL database named after `DB_DATABASE`, then run:

```bash
npm run migration:run
npm run seed
```

### Seeder

Run the seed script:

```bash
npm run seed
```

The seed script runs inside **one transaction** and follows the required dependency order:

`roles -> permissions -> role_permissions -> admin -> students -> courses -> enrollments`

It checks which records already exist before inserting missing data. Running it multiple times does not create duplicate records.

| Entity | Records and required cases |
|---|---|
| Roles | 2 roles exactly: `admin` and `student` |
| Permissions | All 18 permission strings from Assignment 02, linked to the roles (24 `role_permissions` rows) |
| Admin | 1 initial admin, using `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` from `.env` |
| Students | 3 students: Sara (2 active enrollments), Omar (1 cancelled enrollment), and Lina (no enrollments) |
| Courses | 4 courses: one with `NONE`, one with `PERCENTAGE` (20%), one with `FIXED` (30), and one inactive course |
| Enrollments | 3 persisted records: 2 `ACTIVE` and 1 `CANCELLED`, plus one blocked attempt to enroll in the inactive course (logged, not inserted) |

Sample students, courses, and enrollments are skipped when `NODE_ENV=production`.

Sample student passwords use `student-pass-1` for development and testing.

### Indexes

Indexes were selected according to the application's actual query patterns. Not every candidate column needs its own index.

#### Indexes added

| Table | Column(s) | Type | Why |
|---|---|---|---|
| `admins` | `email` | Unique (constraint, backed by a unique index) | Used for admin login lookup and guarantees unique emails. |
| `students` | `email` | Unique (constraint, backed by a unique index) | Used for student login lookup and guarantees unique emails. |
| `enrollments` | `(studentId, courseId)` | Composite | Serves the duplicate-enrollment check in `POST /api/enrollments` and `GET /api/students/:id/enrollments`; `studentId` comes first so queries filtering by it alone can use the index too. |
| `enrollments` | `courseId` | Regular | Supports `GET /api/courses/:id/enrollments`. |
| `enrollments` | `(studentId, courseId)` where `status = 'ACTIVE'` | Partial unique | Prevents more than one active enrollment for the same student and course, while allowing re-enrollment after cancellation. |
| `role_permissions` | `rolesId`, `permissionsId` | Regular | Supports lookups through the role-permissions join table when loading permissions during login. |

Primary keys and the unique constraints on `roles.name` and `permissions.name` also create indexes implicitly.

#### Candidate indexes deliberately not added

| Column(s) | Why not |
|---|---|
| `enrollments.studentId` alone | Redundant because the composite index starts with `studentId` and supports queries filtering by that column. |
| `enrollments.status` | There are no queries filtering by status alone. The relevant active-enrollment constraint is handled by the partial unique index. |
| `courses.isActive` | Courses are loaded by primary key, and the active flag is checked in application code. The table is also small and the column has low selectivity. |

PostgreSQL may still choose sequential scans for small tables. These index choices are based on application query patterns, not performance benchmarks.

### Transactions

Transactions ensure that related database operations succeed or fail together. Both critical flows use `DataSource.transaction`, so all reads and writes in each flow use the same transaction manager.

#### `POST /api/enrollments`

The following operations run inside one transaction:

1. Check that the student exists.
2. Check that the course exists and is active.
3. Check that the student does not already have an active enrollment in that course.
4. Insert the new enrollment.

The student row is read using `FOR SHARE`.

A partial unique index on `(studentId, courseId)` for `ACTIVE` enrollments provides a final database-level safeguard against concurrent duplicate requests. Unique constraint violations are mapped to `409 Conflict`.

#### `DELETE /api/students/:id`

The following operations run inside one transaction:

1. Lock the student row using `FOR UPDATE`.
2. Change all of the student's `ACTIVE` enrollments to `CANCELLED`.
3. Soft-delete the student.

Other enrollment statuses are preserved as history.

If any operation fails, the transaction rolls back all changes, preventing partially applied deletions or inconsistent related records.

## License

This project is private and is not licensed for public redistribution.