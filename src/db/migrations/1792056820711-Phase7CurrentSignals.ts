import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase7CurrentSignals1792056820711 implements MigrationInterface {
  name = 'Phase7CurrentSignals1792056820711';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "current_trigger_ids" uuid array NOT NULL DEFAULT '{}'`,
    );
    // Cảnh báo đã có: dấu hiệu hiện tại = trigger của lần chạy đã áp dụng gần nhất (như trước Phase 7).
    await queryRunner.query(
      `UPDATE "alerts" a SET "current_trigger_ids" = COALESCE((SELECT array_agg(t."id") FROM "rule_triggers" t WHERE t."alert_id" = a."alert_id" AND t."evaluation_run_id" = a."last_evaluation_run_id"), '{}')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "current_trigger_ids"`);
  }
}
