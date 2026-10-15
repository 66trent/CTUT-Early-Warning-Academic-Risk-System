import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase5Alerts1791894767461 implements MigrationInterface {
  name = 'Phase5Alerts1791894767461';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Người dùng chốt: mở lại theo dấu hiệu mới/nặng hơn, cooldown mặc định 0 = tắt (docs/rules/08).
    await queryRunner.query(`UPDATE "rules" SET "cooldown" = 0 WHERE "cooldown" = 168`);
    await queryRunner.query(
      `CREATE TYPE "public"."alert_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'INVALIDATED', 'REOPENED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "alerts" ("alert_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" character varying(20) NOT NULL, "term_id" character varying(10) NOT NULL, "severity" "public"."severity" NOT NULL, "status" "public"."alert_status" NOT NULL, "first_detected_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_detected_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_as_of" TIMESTAMP WITH TIME ZONE NOT NULL, "last_evaluation_run_id" uuid NOT NULL, "closed_at" TIMESTAMP WITH TIME ZONE, "assigned_advisor_id" character varying(20), "risk_score_log_id" uuid, "closed_reason" text, "is_reference_only" boolean NOT NULL DEFAULT true, CONSTRAINT "CHK_alerts_reference_only" CHECK ("is_reference_only" = true), CONSTRAINT "PK_b58263d5bb1ef9464b2cf8da9e5" PRIMARY KEY ("alert_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_alerts_student_term_active" ON "alerts" ("student_id", "term_id") WHERE "status" <> 'INVALIDATED'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_32d95b6b7b8f2ef210d908de0f" ON "alerts" ("student_id", "term_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "alert_state_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alert_id" uuid NOT NULL, "from_status" "public"."alert_status", "to_status" "public"."alert_status" NOT NULL, "changed_by" character varying(20), "reason" text, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_39010dcb09309ce19941839e721" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1fd5c7b5db89147ed93a91c7d9" ON "alert_state_history" ("alert_id", "changed_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."intervention_type" AS ENUM('EMAIL', 'PHONE_CALL', 'IN_PERSON_MEETING', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."confidentiality_level" AS ENUM('NORMAL', 'SENSITIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "interventions" ("intervention_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alert_id" uuid NOT NULL, "performed_by" character varying(20) NOT NULL, "type" "public"."intervention_type" NOT NULL, "content" text NOT NULL, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "outcome" text, "next_follow_up_at" TIMESTAMP WITH TIME ZONE, "status" character varying(20) NOT NULL, "confidentiality_level" "public"."confidentiality_level" NOT NULL, CONSTRAINT "PK_89263ff82d11442a4fec45e7541" PRIMARY KEY ("intervention_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f14680cb46b6f703136bdfa8f" ON "interventions" ("alert_id", "performed_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'IN_APP')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_status" AS ENUM('QUEUED', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("notification_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alert_id" uuid NOT NULL, "recipient_id" character varying(20) NOT NULL, "channel" "public"."notification_channel" NOT NULL, "status" "public"."notification_status" NOT NULL, "event" character varying(30) NOT NULL, "evaluation_run_id" uuid NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_eaedfe19f0f765d26afafa85956" PRIMARY KEY ("notification_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_935ceb01a7f1577d4d17a0a5a5" ON "notifications" ("alert_id", "channel", "event", "evaluation_run_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df91f776e69e5649298260c00b" ON "notifications" ("recipient_id", "channel", "read_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c1010a6b7db6fba57650b4b299" ON "notifications" ("alert_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a59ed09fcb61340b5d4196f9e2" ON "rule_triggers" ("term_id", "rule_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8a6b0edb4ba645cadf6ad8bab7" ON "rule_triggers" ("alert_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_dfa986212077b0935cb2f392d04" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_a542868c0157e58845edc69cc02" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_ca17cd2b6a6adc2f5fc9fcffbe4" FOREIGN KEY ("assigned_advisor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_d1bc6f2766cbc8841bdb291883c" FOREIGN KEY ("risk_score_log_id") REFERENCES "risk_score_logs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_state_history" ADD CONSTRAINT "FK_77b4b3a4d5b6b3dd88b6de3c2ab" FOREIGN KEY ("alert_id") REFERENCES "alerts"("alert_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_state_history" ADD CONSTRAINT "FK_918bacd9d01de8cb0dc086f2d09" FOREIGN KEY ("changed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interventions" ADD CONSTRAINT "FK_5812cba994d159b561e53aa6b50" FOREIGN KEY ("alert_id") REFERENCES "alerts"("alert_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interventions" ADD CONSTRAINT "FK_5ee6016cf41541a0a9836d60b33" FOREIGN KEY ("performed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9589e72e51c4f089bb9655d3273" FOREIGN KEY ("alert_id") REFERENCES "alerts"("alert_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_5332a4daa46fd3f4e6625dd275d" FOREIGN KEY ("recipient_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" ADD CONSTRAINT "FK_8a6b0edb4ba645cadf6ad8bab73" FOREIGN KEY ("alert_id") REFERENCES "alerts"("alert_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rule_triggers" DROP CONSTRAINT "FK_8a6b0edb4ba645cadf6ad8bab73"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_5332a4daa46fd3f4e6625dd275d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9589e72e51c4f089bb9655d3273"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interventions" DROP CONSTRAINT "FK_5ee6016cf41541a0a9836d60b33"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interventions" DROP CONSTRAINT "FK_5812cba994d159b561e53aa6b50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_state_history" DROP CONSTRAINT "FK_918bacd9d01de8cb0dc086f2d09"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_state_history" DROP CONSTRAINT "FK_77b4b3a4d5b6b3dd88b6de3c2ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_d1bc6f2766cbc8841bdb291883c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_ca17cd2b6a6adc2f5fc9fcffbe4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_a542868c0157e58845edc69cc02"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_dfa986212077b0935cb2f392d04"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_8a6b0edb4ba645cadf6ad8bab7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a59ed09fcb61340b5d4196f9e2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c1010a6b7db6fba57650b4b299"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_df91f776e69e5649298260c00b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_935ceb01a7f1577d4d17a0a5a5"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notification_status"`);
    await queryRunner.query(`DROP TYPE "public"."notification_channel"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4f14680cb46b6f703136bdfa8f"`);
    await queryRunner.query(`DROP TABLE "interventions"`);
    await queryRunner.query(`DROP TYPE "public"."confidentiality_level"`);
    await queryRunner.query(`DROP TYPE "public"."intervention_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1fd5c7b5db89147ed93a91c7d9"`);
    await queryRunner.query(`DROP TABLE "alert_state_history"`);
    await queryRunner.query(`DROP TYPE "public"."alert_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_32d95b6b7b8f2ef210d908de0f"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_alerts_student_term_active"`);
    await queryRunner.query(`DROP TABLE "alerts"`);
  }
}
