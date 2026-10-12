import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3bSourceRecords1791810699905 implements MigrationInterface {
  name = 'Phase3bSourceRecords1791810699905';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "courses" ("course_id" character varying(20) NOT NULL, "course_name" character varying(150) NOT NULL, "credits" integer, "theory_periods" integer, "practice_periods" integer, CONSTRAINT "PK_42dc69837b2e7bc603686ddaf53" PRIMARY KEY ("course_id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."enrollment_status" AS ENUM('REGISTERED', 'WITHDRAWN', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attempt_outcome" AS ENUM('PENDING', 'PASSED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "enrollments" ("enrollment_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" character varying(20) NOT NULL, "course_id" character varying(20) NOT NULL, "term_id" character varying(10) NOT NULL, "enrollment_status" "public"."enrollment_status" NOT NULL, "attempt_number" integer NOT NULL, "attempt_outcome" "public"."attempt_outcome" NOT NULL DEFAULT 'PENDING', "first_seen_batch_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3e9102cadbf8e3aaabc5acc6042" PRIMARY KEY ("enrollment_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_79e38e189649052f0595e3511d" ON "enrollments" ("first_seen_batch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53673a5e34c650c5c6ca49d724" ON "enrollments" ("term_id", "course_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7f0a694ddd9038a74a9b3b4a94" ON "enrollments" ("student_id", "course_id", "term_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "attendance_summaries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enrollment_id" uuid NOT NULL, "snapshot_date" TIMESTAMP WITH TIME ZONE NOT NULL, "total_sessions" integer NOT NULL, "planned_sessions" integer, "present" integer NOT NULL, "late" integer NOT NULL, "excused_absence" integer NOT NULL, "unexcused_absence" integer NOT NULL, "section_code" character varying(30), "import_batch_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d73f4f9b9389ea8ce6928a3e65" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ccd90947c60ddae222b9287bf1" ON "attendance_summaries" ("import_batch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bcbe36d61f191d63fb4f80f7d6" ON "attendance_summaries" ("enrollment_id", "snapshot_date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."course_result_status" AS ENUM('PROCESS_ONLY', 'FINAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enrollment_id" uuid NOT NULL, "process_score" double precision, "exam_score" double precision, "final_score" double precision, "letter_grade" character varying(2), "passed" boolean, "result_status" "public"."course_result_status" NOT NULL, "import_batch_id" uuid NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL, "imported_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_40df244272069607bcbd611e513" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_849dd2fdc688844735685e8b64" ON "course_results" ("import_batch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_257022247f4dd242a9eb34e10d" ON "course_results" ("enrollment_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quiz_attempt_status" AS ENUM('SUBMITTED', 'IN_PROGRESS', 'ABANDONED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_quiz_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enrollment_id" uuid NOT NULL, "quiz_key" character varying(100) NOT NULL, "quiz_name" character varying(200) NOT NULL, "attempt_number" integer NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE, "duration_minutes" double precision, "score" double precision, "max_score" double precision, "status" "public"."quiz_attempt_status" NOT NULL, "section_code" character varying(30), "import_batch_id" uuid NOT NULL, CONSTRAINT "PK_1a6f9786670bc7a253399ff0762" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c8893b45fc2a917b702fb7728" ON "lms_quiz_attempts" ("import_batch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2df007665893c451cea014c508" ON "lms_quiz_attempts" ("enrollment_id", "quiz_key", "attempt_number") `,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_307813fe255896d6ebf3e6cd55c" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_b79d0bf01779fdf9cfb6b092af3" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_2dfaf349e23f59da6f4021970cc" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_79e38e189649052f0595e3511d5" FOREIGN KEY ("first_seen_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" ADD CONSTRAINT "FK_f578cea0bf1fb7bee03db4519fe" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("enrollment_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" ADD CONSTRAINT "FK_ccd90947c60ddae222b9287bf1a" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_results" ADD CONSTRAINT "FK_257022247f4dd242a9eb34e10d5" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("enrollment_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_results" ADD CONSTRAINT "FK_849dd2fdc688844735685e8b646" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" ADD CONSTRAINT "FK_55214ef9ad7353dc2d091f61518" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("enrollment_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" ADD CONSTRAINT "FK_6c8893b45fc2a917b702fb77280" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" DROP CONSTRAINT "FK_6c8893b45fc2a917b702fb77280"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" DROP CONSTRAINT "FK_55214ef9ad7353dc2d091f61518"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_results" DROP CONSTRAINT "FK_849dd2fdc688844735685e8b646"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_results" DROP CONSTRAINT "FK_257022247f4dd242a9eb34e10d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" DROP CONSTRAINT "FK_ccd90947c60ddae222b9287bf1a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" DROP CONSTRAINT "FK_f578cea0bf1fb7bee03db4519fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_79e38e189649052f0595e3511d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_2dfaf349e23f59da6f4021970cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_b79d0bf01779fdf9cfb6b092af3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_307813fe255896d6ebf3e6cd55c"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_2df007665893c451cea014c508"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6c8893b45fc2a917b702fb7728"`);
    await queryRunner.query(`DROP TABLE "lms_quiz_attempts"`);
    await queryRunner.query(`DROP TYPE "public"."quiz_attempt_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_257022247f4dd242a9eb34e10d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_849dd2fdc688844735685e8b64"`);
    await queryRunner.query(`DROP TABLE "course_results"`);
    await queryRunner.query(`DROP TYPE "public"."course_result_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bcbe36d61f191d63fb4f80f7d6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ccd90947c60ddae222b9287bf1"`);
    await queryRunner.query(`DROP TABLE "attendance_summaries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7f0a694ddd9038a74a9b3b4a94"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_53673a5e34c650c5c6ca49d724"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_79e38e189649052f0595e3511d"`);
    await queryRunner.query(`DROP TABLE "enrollments"`);
    await queryRunner.query(`DROP TYPE "public"."attempt_outcome"`);
    await queryRunner.query(`DROP TYPE "public"."enrollment_status"`);
    await queryRunner.query(`DROP TABLE "courses"`);
  }
}
