import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4RuleEngine1791825968315 implements MigrationInterface {
  name = 'Phase4RuleEngine1791825968315';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."evaluation_trigger" AS ENUM('AUTO_AFTER_IMPORT', 'MANUAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evaluation_run_status" AS ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "evaluation_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "term_id" character varying(10) NOT NULL, "course_id" character varying(20), "trigger" "public"."evaluation_trigger" NOT NULL, "as_of" TIMESTAMP WITH TIME ZONE NOT NULL, "triggered_by" character varying(20), "import_batch_id" uuid, "data_warnings" jsonb, "status" "public"."evaluation_run_status" NOT NULL, "total_students" integer NOT NULL DEFAULT '0', "processed_students" integer NOT NULL DEFAULT '0', "alerts_created" integer NOT NULL DEFAULT '0', "alerts_updated" integer NOT NULL DEFAULT '0', "insufficient_count" integer NOT NULL DEFAULT '0', "error_message" text, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fbeb1f5d29c74ecda426e2e98f5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e9cf9940732b6b1d9cd5ff31b9" ON "evaluation_runs" ("term_id", "created_at") `,
    );
    // Tối đa 1 lần chạy QUEUED / phạm vi (học kỳ, học phần) — biểu thức COALESCE nên viết tay.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_evaluation_runs_queued_scope" ON "evaluation_runs" ("term_id", COALESCE("course_id", '')) WHERE "status" = 'QUEUED'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rule_group" AS ENUM('ATTENDANCE', 'ACADEMIC', 'LMS', 'COMBINED', 'EXCEPTION', 'RISK_SCORE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rule_status" AS ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "rules" ("rule_code" character varying(20) NOT NULL, "rule_name" character varying(100) NOT NULL, "rule_group" "public"."rule_group" NOT NULL, "scope" character varying(30) NOT NULL, "priority" integer NOT NULL, "cooldown" integer NOT NULL, "status" "public"."rule_status" NOT NULL, CONSTRAINT "PK_4fd3adac059a4fc6462fcb21dae" PRIMARY KEY ("rule_code"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "rule_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rule_code" character varying(20) NOT NULL, "version" integer NOT NULL, "condition" jsonb NOT NULL, "severity" "public"."severity" NOT NULL, "action" jsonb NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "status" "public"."rule_status" NOT NULL, "configured_by" character varying(20) NOT NULL, "last_dry_run_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f94078d9fb0f85dcdf3ceaec3ec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rule_versions_single_active" ON "rule_versions" ("rule_code") WHERE "status" = 'ACTIVE'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0bcebcd05eaeb78869e14bda9f" ON "rule_versions" ("rule_code", "version") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."data_completeness_level" AS ENUM('FULL', 'PARTIAL', 'INSUFFICIENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_score_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" character varying(20) NOT NULL, "term_id" character varying(10) NOT NULL, "risk_score_value" double precision, "data_completeness_level" "public"."data_completeness_level" NOT NULL, "components_used" jsonb NOT NULL, "rule_version_id" uuid NOT NULL, "evaluation_run_id" uuid NOT NULL, "calculated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_0229cf00b32115ce2270a144a86" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4a841717ac4d29de4c4b18e3e4" ON "risk_score_logs" ("evaluation_run_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aed10dbe140dcbde5e39e07d5a" ON "risk_score_logs" ("student_id", "term_id", "calculated_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "rule_triggers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alert_id" uuid, "evaluation_run_id" uuid NOT NULL, "rule_code" character varying(20) NOT NULL, "rule_version_id" uuid NOT NULL, "student_id" character varying(20) NOT NULL, "scope_id" character varying(20) NOT NULL, "term_id" character varying(10) NOT NULL, "triggered_at" TIMESTAMP WITH TIME ZONE NOT NULL, "input_snapshot" jsonb NOT NULL, "reason" text NOT NULL, "severity" "public"."severity" NOT NULL, CONSTRAINT "PK_581efac6dc02536fc12b034811b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_36502b3c582a8e55e67d16d281" ON "rule_triggers" ("student_id", "term_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef53ab5379cb79afc646909fb6" ON "rule_triggers" ("evaluation_run_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ADD CONSTRAINT "FK_c5ef2bbe562f4c5416ad56c6617" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ADD CONSTRAINT "FK_b0d0473b58b478308aac8452032" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ADD CONSTRAINT "FK_75323838d33e421b4cb8f2ec97b" FOREIGN KEY ("triggered_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ADD CONSTRAINT "FK_d01119d9adfac61f872a4866233" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_versions" ADD CONSTRAINT "FK_1724d8f90bcc5380696a1b6ed16" FOREIGN KEY ("rule_code") REFERENCES "rules"("rule_code") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_versions" ADD CONSTRAINT "FK_2f573d136b9a3ffdae6931cfb97" FOREIGN KEY ("configured_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" ADD CONSTRAINT "FK_62196a24b0f6714ff71b4a1fbe2" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" ADD CONSTRAINT "FK_e9709f3f6db2acc1b09a173cd0b" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" ADD CONSTRAINT "FK_fba3b84c0ea6932e985f9676424" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" ADD CONSTRAINT "FK_4a841717ac4d29de4c4b18e3e4f" FOREIGN KEY ("evaluation_run_id") REFERENCES "evaluation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" ADD CONSTRAINT "FK_ef53ab5379cb79afc646909fb6d" FOREIGN KEY ("evaluation_run_id") REFERENCES "evaluation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" ADD CONSTRAINT "FK_a9e87c35c676b935661500ea71d" FOREIGN KEY ("rule_code") REFERENCES "rules"("rule_code") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" ADD CONSTRAINT "FK_17c69b068e09e0cdcf6b274e8bb" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" ADD CONSTRAINT "FK_ac81b582d1b0a4a90e460994cb3" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" ADD CONSTRAINT "FK_bb61d4725b02bcc6f3dec897542" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" DROP CONSTRAINT "FK_bb61d4725b02bcc6f3dec897542"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" DROP CONSTRAINT "FK_ac81b582d1b0a4a90e460994cb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" DROP CONSTRAINT "FK_17c69b068e09e0cdcf6b274e8bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" DROP CONSTRAINT "FK_a9e87c35c676b935661500ea71d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" DROP CONSTRAINT "FK_ef53ab5379cb79afc646909fb6d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" DROP CONSTRAINT "FK_4a841717ac4d29de4c4b18e3e4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" DROP CONSTRAINT "FK_fba3b84c0ea6932e985f9676424"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" DROP CONSTRAINT "FK_e9709f3f6db2acc1b09a173cd0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_score_logs" DROP CONSTRAINT "FK_62196a24b0f6714ff71b4a1fbe2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_versions" DROP CONSTRAINT "FK_2f573d136b9a3ffdae6931cfb97"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_versions" DROP CONSTRAINT "FK_1724d8f90bcc5380696a1b6ed16"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" DROP CONSTRAINT "FK_d01119d9adfac61f872a4866233"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" DROP CONSTRAINT "FK_75323838d33e421b4cb8f2ec97b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" DROP CONSTRAINT "FK_b0d0473b58b478308aac8452032"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" DROP CONSTRAINT "FK_c5ef2bbe562f4c5416ad56c6617"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ef53ab5379cb79afc646909fb6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_36502b3c582a8e55e67d16d281"`);
    await queryRunner.query(`DROP TABLE "rule_triggers"`);
    await queryRunner.query(`DROP TYPE "public"."severity"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aed10dbe140dcbde5e39e07d5a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4a841717ac4d29de4c4b18e3e4"`);
    await queryRunner.query(`DROP TABLE "risk_score_logs"`);
    await queryRunner.query(`DROP TYPE "public"."data_completeness_level"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0bcebcd05eaeb78869e14bda9f"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_rule_versions_single_active"`);
    await queryRunner.query(`DROP TABLE "rule_versions"`);
    await queryRunner.query(`DROP TYPE "public"."rule_status"`);
    await queryRunner.query(`DROP TABLE "rules"`);
    await queryRunner.query(`DROP TYPE "public"."rule_group"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_evaluation_runs_queued_scope"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e9cf9940732b6b1d9cd5ff31b9"`);
    await queryRunner.query(`DROP TABLE "evaluation_runs"`);
    await queryRunner.query(`DROP TYPE "public"."evaluation_run_status"`);
    await queryRunner.query(`DROP TYPE "public"."evaluation_trigger"`);
  }
}
