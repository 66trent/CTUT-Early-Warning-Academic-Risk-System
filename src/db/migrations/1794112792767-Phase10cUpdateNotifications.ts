import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase10cUpdateNotifications1794112792767 implements MigrationInterface {
  name = 'Phase10cUpdateNotifications1794112792767';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "update_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recipient_id" character varying(20) NOT NULL, "evaluation_run_id" uuid NOT NULL, "term_id" character varying(10) NOT NULL, "title" character varying(200) NOT NULL, "body" character varying(300) NOT NULL, "link" character varying(255) NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_389322c4311a447703c45f5878c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c7a8df7f4636526dc52b60a492" ON "update_notifications" ("recipient_id", "read_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_234b348096a9afda9d6cc4104c" ON "update_notifications" ("evaluation_run_id", "recipient_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "update_notifications" ADD CONSTRAINT "FK_d6d08edcc2fa743618c88fe933b" FOREIGN KEY ("recipient_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "update_notifications" ADD CONSTRAINT "FK_92193298f5179a4a644c4da99df" FOREIGN KEY ("evaluation_run_id") REFERENCES "evaluation_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "update_notifications" DROP CONSTRAINT "FK_92193298f5179a4a644c4da99df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "update_notifications" DROP CONSTRAINT "FK_d6d08edcc2fa743618c88fe933b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_234b348096a9afda9d6cc4104c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c7a8df7f4636526dc52b60a492"`);
    await queryRunner.query(`DROP TABLE "update_notifications"`);
  }
}
