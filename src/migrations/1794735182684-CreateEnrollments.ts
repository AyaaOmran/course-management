import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEnrollments1794735182684 implements MigrationInterface {
    name = 'CreateEnrollments1794735182684'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."enrollments_status_enum" AS ENUM('ACTIVE', 'CANCELLED', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "enrollments" ("id" SERIAL NOT NULL, "studentId" integer NOT NULL, "courseId" integer NOT NULL, "priceAtEnrollment" numeric(10,2) NOT NULL, "status" "public"."enrollments_status_enum" NOT NULL DEFAULT 'ACTIVE', "enrolledAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7c0f752f9fb68bf6ed7367ab00f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_enrollments_course" ON "enrollments"  ("courseId") `);
        await queryRunner.query(`CREATE INDEX "idx_enrollments_student_course" ON "enrollments"  ("studentId", "courseId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_enrollments_active_student_course" ON "enrollments"  ("studentId", "courseId") WHERE "status" = 'ACTIVE'`);
        await queryRunner.query(`ALTER TABLE "enrollments" ADD CONSTRAINT "FK_bf3ba3dfa95e2df7388eb4589fd" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "enrollments" ADD CONSTRAINT "FK_60dd0ae4e21002e63a5fdefeec8" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "enrollments" DROP CONSTRAINT "FK_60dd0ae4e21002e63a5fdefeec8"`);
        await queryRunner.query(`ALTER TABLE "enrollments" DROP CONSTRAINT "FK_bf3ba3dfa95e2df7388eb4589fd"`);
        await queryRunner.query(`DROP INDEX "public"."uq_enrollments_active_student_course"`);
        await queryRunner.query(`DROP INDEX "public"."idx_enrollments_student_course"`);
        await queryRunner.query(`DROP INDEX "public"."idx_enrollments_course"`);
        await queryRunner.query(`DROP TABLE "enrollments"`);
        await queryRunner.query(`DROP TYPE "public"."enrollments_status_enum"`);
    }

}