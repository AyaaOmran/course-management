import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCourses1794735182683 implements MigrationInterface {
    name = 'CreateCourses1794735182683'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."courses_discounttype_enum" AS ENUM('NONE', 'PERCENTAGE', 'FIXED')`);
        await queryRunner.query(`CREATE TABLE "courses" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" character varying NOT NULL, "price" numeric(10,2) NOT NULL, "discountType" "public"."courses_discounttype_enum" NOT NULL DEFAULT 'NONE', "discountValue" numeric(10,2) NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "courses"`);
        await queryRunner.query(`DROP TYPE "public"."courses_discounttype_enum"`);
    }

}