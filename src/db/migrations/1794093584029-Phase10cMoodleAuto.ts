import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase10cMoodleAuto1794093584029 implements MigrationInterface {
  name = 'Phase10cMoodleAuto1794093584029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "moodle_event_inbox" ("event_id" uuid NOT NULL, "event_name" character varying(120) NOT NULL, "moodle_course_id" integer NOT NULL, "object_id" integer, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "outcome" character varying(20) NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_66a23f7dc69017acde571e09119" PRIMARY KEY ("event_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5fa4b6622138a028a73a251b85" ON "moodle_event_inbox" ("received_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "sync_mode" character varying(10) NOT NULL DEFAULT 'MANUAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "fingerprint" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "last_checked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "pending_event_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "seen_student_ids" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "left_students" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "seen_activities" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD "removed_activities" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_sync_runs" ADD "mode" character varying(10) NOT NULL DEFAULT 'MANUAL'`,
    );
    await queryRunner.query(`ALTER TABLE "moodle_sync_runs" ADD "link_ids" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "moodle_sync_runs" DROP COLUMN "link_ids"`);
    await queryRunner.query(`ALTER TABLE "moodle_sync_runs" DROP COLUMN "mode"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "removed_activities"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "seen_activities"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "left_students"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "seen_student_ids"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "pending_event_at"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "last_checked_at"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "fingerprint"`);
    await queryRunner.query(`ALTER TABLE "moodle_course_links" DROP COLUMN "sync_mode"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5fa4b6622138a028a73a251b85"`);
    await queryRunner.query(`DROP TABLE "moodle_event_inbox"`);
  }
}
