import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase1Identity1791766886196 implements MigrationInterface {
  name = 'Phase1Identity1791766886196';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "departments" ("department_id" character varying(10) NOT NULL, "department_name" character varying(150) NOT NULL, CONSTRAINT "PK_202cd845b076ed15836884084eb" PRIMARY KEY ("department_id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('STUDENT', 'ADVISOR', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_account_status" AS ENUM('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("user_id" character varying(20) NOT NULL, "full_name" character varying(100) NOT NULL, "role" "public"."user_role" NOT NULL, "email" character varying(100) NOT NULL, "account_status" "public"."user_account_status" NOT NULL, "auth_user_id" character varying(64), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_8d4681a2d24fe0a272f0f6cce7f" UNIQUE ("auth_user_id"), CONSTRAINT "CHK_users_email_lowercase" CHECK ("email" = lower("email")), CONSTRAINT "CHK_users_student_email_domain" CHECK ("role" <> 'STUDENT' OR "email" LIKE '%@student.ctuet.edu.vn'), CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_ace513fa30d485cfd25c11a9e4" ON "users" ("role") `);
    await queryRunner.query(
      `CREATE TABLE "administrative_classes" ("class_id" character varying(20) NOT NULL, "class_name" character varying(100) NOT NULL, "department_id" character varying(10) NOT NULL, "cohort_year" character varying(10) NOT NULL, "advisor_id" character varying(20), CONSTRAINT "PK_144c0f4fffc9d20a20b5e63478c" PRIMARY KEY ("class_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9d4d95ce91832837a4d531b56" ON "administrative_classes" ("advisor_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" character varying(20), "action" character varying(60) NOT NULL, "target_type" character varying(40) NOT NULL, "target_id" character varying(40), "detail" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON "audit_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_99fca4a3a4a93c26a756c5aca5" ON "audit_logs" ("action", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4a85d553dbb4006bd350ab6f88" ON "audit_logs" ("actor_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."official_academic_status" AS ENUM('ACTIVE', 'RESERVED', 'SUSPENDED', 'GRADUATED', 'DISMISSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "students" ("student_id" character varying(20) NOT NULL, "full_name" character varying(100) NOT NULL, "class_id" character varying(20) NOT NULL, "official_academic_status" "public"."official_academic_status" NOT NULL, CONSTRAINT "PK_ba36f3e3743f80d1cdc51020103" PRIMARY KEY ("student_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_de6ad4ae6936dce474e2823984" ON "students" ("class_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "terms" ("term_id" character varying(10) NOT NULL, "term_name" character varying(50) NOT NULL, "academic_year" character varying(10) NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE NOT NULL, "is_current" boolean NOT NULL DEFAULT false, "closed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_30b55d510feff7ac64acb367ec3" PRIMARY KEY ("term_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_terms_single_current" ON "terms" ("is_current") WHERE "is_current" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrative_classes" ADD CONSTRAINT "FK_7a8c7a791990dbe6a8e0299da62" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrative_classes" ADD CONSTRAINT "FK_f9d4d95ce91832837a4d531b569" FOREIGN KEY ("advisor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_de6ad4ae6936dce474e2823984e" FOREIGN KEY ("class_id") REFERENCES "administrative_classes"("class_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_ba36f3e3743f80d1cdc51020103" FOREIGN KEY ("student_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_ba36f3e3743f80d1cdc51020103"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_de6ad4ae6936dce474e2823984e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrative_classes" DROP CONSTRAINT "FK_f9d4d95ce91832837a4d531b569"`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrative_classes" DROP CONSTRAINT "FK_7a8c7a791990dbe6a8e0299da62"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_terms_single_current"`);
    await queryRunner.query(`DROP TABLE "terms"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_de6ad4ae6936dce474e2823984"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TYPE "public"."official_academic_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4a85d553dbb4006bd350ab6f88"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_99fca4a3a4a93c26a756c5aca5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2cd10fda8276bb995288acfbfb"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f9d4d95ce91832837a4d531b56"`);
    await queryRunner.query(`DROP TABLE "administrative_classes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ace513fa30d485cfd25c11a9e4"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_account_status"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(`DROP TABLE "departments"`);
  }
}
