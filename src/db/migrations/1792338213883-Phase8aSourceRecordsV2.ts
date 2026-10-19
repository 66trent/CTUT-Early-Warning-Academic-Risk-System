import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase8aSourceRecordsV21792338213883 implements MigrationInterface {
  name = 'Phase8aSourceRecordsV21792338213883';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 8a (người dùng chốt 2026-10-18, đã pg_dump trước): đổi cấu trúc dữ liệu nguồn (điểm
    // danh theo tiết, LMS tách bài trắc nghiệm / thực hành, kết quả chỉ khi khóa điểm) và bộ luật
    // 12 luật → làm sạch dữ liệu học tập, cảnh báo, luật. Giữ tài khoản, khoa, lớp, sinh viên,
    // học kỳ, Audit Log. Luật được seed lại bằng `npm run seed`.
    await queryRunner.query(
      `TRUNCATE TABLE "rule_triggers", "risk_score_logs", "notifications", "interventions", "alert_state_history", "alerts", "evaluation_runs", "attendance_summaries", "lms_quiz_attempts", "course_results", "enrollments", "courses", "import_error_rows", "import_batches", "rule_versions", "rules" CASCADE`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_2df007665893c451cea014c508"`);
    await queryRunner.query(
      `CREATE TYPE "public"."lms_activity_type" AS ENUM('QUIZ', 'ASSIGNMENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "course_id" character varying(20) NOT NULL, "term_id" character varying(10) NOT NULL, "section_code" character varying(30) NOT NULL, "activity_type" "public"."lms_activity_type" NOT NULL, "activity_key" character varying(100) NOT NULL, "activity_name" character varying(200) NOT NULL, "due_at" TIMESTAMP WITH TIME ZONE, "import_batch_id" uuid NOT NULL, CONSTRAINT "PK_63b903ca5633a149209d785fcd1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87ca397b24ace5a34ce1b2db94" ON "lms_activities" ("import_batch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5f548a9688ff32caa4fb486d4f" ON "lms_activities" ("course_id", "term_id", "section_code", "activity_type", "activity_key") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."submission_status" AS ENUM('ON_TIME', 'LATE', 'NOT_SUBMITTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_assignment_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enrollment_id" uuid NOT NULL, "activity_id" uuid NOT NULL, "status" "public"."submission_status" NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE, "import_batch_id" uuid NOT NULL, CONSTRAINT "PK_67d352f61d4d2d7f9dc108d4c44" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1f5eae56b5590da8c7c595d894" ON "lms_assignment_submissions" ("import_batch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03bcd16f7a93c5dae1843063a0" ON "lms_assignment_submissions" ("activity_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8c18ee5aecbdacffc042bbfa54" ON "lms_assignment_submissions" ("enrollment_id", "activity_id") `,
    );
    await queryRunner.query(`ALTER TABLE "attendance_summaries" DROP COLUMN "total_sessions"`);
    await queryRunner.query(`ALTER TABLE "attendance_summaries" DROP COLUMN "planned_sessions"`);
    await queryRunner.query(`ALTER TABLE "attendance_summaries" DROP COLUMN "present"`);
    await queryRunner.query(`ALTER TABLE "attendance_summaries" DROP COLUMN "late"`);
    await queryRunner.query(`ALTER TABLE "course_results" DROP COLUMN "final_score"`);
    await queryRunner.query(`ALTER TABLE "course_results" DROP COLUMN "result_status"`);
    await queryRunner.query(`DROP TYPE "public"."course_result_status"`);
    await queryRunner.query(`ALTER TABLE "course_results" DROP COLUMN "process_published_at"`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" DROP COLUMN "quiz_key"`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" DROP COLUMN "quiz_name"`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" DROP COLUMN "section_code"`);
    await queryRunner.query(`ALTER TABLE "import_batches" ADD "course_id" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "enrollments" ADD "section_code" character varying(30)`);
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" ADD "total_periods" integer NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "course_results" ADD "eligible_for_exam" boolean`);
    await queryRunner.query(`ALTER TABLE "course_results" ADD "absent_from_exam" boolean`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" ADD "activity_id" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" ADD "correct_count" integer`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" ADD "total_questions" integer`);
    await queryRunner.query(
      `ALTER TYPE "public"."evaluation_trigger" RENAME TO "evaluation_trigger_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evaluation_trigger" AS ENUM('AUTO_AFTER_IMPORT', 'MANUAL', 'SCHEDULED', 'TERM_CLOSING')`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ALTER COLUMN "trigger" TYPE "public"."evaluation_trigger" USING "trigger"::"text"::"public"."evaluation_trigger"`,
    );
    await queryRunner.query(`DROP TYPE "public"."evaluation_trigger_old"`);
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" ALTER COLUMN "section_code" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_results" ALTER COLUMN "letter_grade" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "course_results" ALTER COLUMN "passed" SET NOT NULL`);
    await queryRunner.query(
      `CREATE INDEX "IDX_0ac6614f189960d46df6ebd6c4" ON "lms_quiz_attempts" ("activity_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97fa68b875d922a9e283333520" ON "lms_quiz_attempts" ("enrollment_id", "activity_id", "attempt_number") `,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" ADD CONSTRAINT "FK_6033cbc1411d7b30d100d8b3429" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_activities" ADD CONSTRAINT "FK_5e9adaccbaba21eff5ca687c0cc" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_activities" ADD CONSTRAINT "FK_05814412d0666bfd1cc15d2f2c1" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_activities" ADD CONSTRAINT "FK_87ca397b24ace5a34ce1b2db94b" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" ADD CONSTRAINT "FK_569729b2c8484c7500312c682b8" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("enrollment_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" ADD CONSTRAINT "FK_03bcd16f7a93c5dae1843063a0b" FOREIGN KEY ("activity_id") REFERENCES "lms_activities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" ADD CONSTRAINT "FK_1f5eae56b5590da8c7c595d894d" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" ADD CONSTRAINT "FK_0ac6614f189960d46df6ebd6c4a" FOREIGN KEY ("activity_id") REFERENCES "lms_activities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" DROP CONSTRAINT "FK_0ac6614f189960d46df6ebd6c4a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" DROP CONSTRAINT "FK_1f5eae56b5590da8c7c595d894d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" DROP CONSTRAINT "FK_03bcd16f7a93c5dae1843063a0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" DROP CONSTRAINT "FK_569729b2c8484c7500312c682b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_activities" DROP CONSTRAINT "FK_87ca397b24ace5a34ce1b2db94b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_activities" DROP CONSTRAINT "FK_05814412d0666bfd1cc15d2f2c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_activities" DROP CONSTRAINT "FK_5e9adaccbaba21eff5ca687c0cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" DROP CONSTRAINT "FK_6033cbc1411d7b30d100d8b3429"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_97fa68b875d922a9e283333520"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0ac6614f189960d46df6ebd6c4"`);
    await queryRunner.query(`ALTER TABLE "course_results" ALTER COLUMN "passed" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "course_results" ALTER COLUMN "letter_grade" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" ALTER COLUMN "section_code" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evaluation_trigger_old" AS ENUM('AUTO_AFTER_IMPORT', 'MANUAL', 'SCHEDULED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ALTER COLUMN "trigger" TYPE "public"."evaluation_trigger_old" USING "trigger"::"text"::"public"."evaluation_trigger_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."evaluation_trigger"`);
    await queryRunner.query(
      `ALTER TYPE "public"."evaluation_trigger_old" RENAME TO "evaluation_trigger"`,
    );
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" DROP COLUMN "total_questions"`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" DROP COLUMN "correct_count"`);
    await queryRunner.query(`ALTER TABLE "lms_quiz_attempts" DROP COLUMN "activity_id"`);
    await queryRunner.query(`ALTER TABLE "course_results" DROP COLUMN "absent_from_exam"`);
    await queryRunner.query(`ALTER TABLE "course_results" DROP COLUMN "eligible_for_exam"`);
    await queryRunner.query(`ALTER TABLE "attendance_summaries" DROP COLUMN "total_periods"`);
    await queryRunner.query(`ALTER TABLE "enrollments" DROP COLUMN "section_code"`);
    await queryRunner.query(`ALTER TABLE "import_batches" DROP COLUMN "course_id"`);
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" ADD "section_code" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" ADD "quiz_name" character varying(200) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_attempts" ADD "quiz_key" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_results" ADD "process_published_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."course_result_status" AS ENUM('PROCESS_ONLY', 'FINAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_results" ADD "result_status" "public"."course_result_status" NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "course_results" ADD "final_score" double precision`);
    await queryRunner.query(`ALTER TABLE "attendance_summaries" ADD "late" integer NOT NULL`);
    await queryRunner.query(`ALTER TABLE "attendance_summaries" ADD "present" integer NOT NULL`);
    await queryRunner.query(`ALTER TABLE "attendance_summaries" ADD "planned_sessions" integer`);
    await queryRunner.query(
      `ALTER TABLE "attendance_summaries" ADD "total_sessions" integer NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_8c18ee5aecbdacffc042bbfa54"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_03bcd16f7a93c5dae1843063a0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1f5eae56b5590da8c7c595d894"`);
    await queryRunner.query(`DROP TABLE "lms_assignment_submissions"`);
    await queryRunner.query(`DROP TYPE "public"."submission_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5f548a9688ff32caa4fb486d4f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_87ca397b24ace5a34ce1b2db94"`);
    await queryRunner.query(`DROP TABLE "lms_activities"`);
    await queryRunner.query(`DROP TYPE "public"."lms_activity_type"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2df007665893c451cea014c508" ON "lms_quiz_attempts" ("enrollment_id", "quiz_key", "attempt_number") `,
    );
  }
}
