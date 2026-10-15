import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase7AlertsSchedule1792054500276 implements MigrationInterface {
  name = 'Phase7AlertsSchedule1792054500276';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "signals_cleared_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."evaluation_trigger" RENAME TO "evaluation_trigger_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evaluation_trigger" AS ENUM('AUTO_AFTER_IMPORT', 'MANUAL', 'SCHEDULED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ALTER COLUMN "trigger" TYPE "public"."evaluation_trigger" USING "trigger"::"text"::"public"."evaluation_trigger"`,
    );
    await queryRunner.query(`DROP TYPE "public"."evaluation_trigger_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."evaluation_trigger_old" AS ENUM('AUTO_AFTER_IMPORT', 'MANUAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_runs" ALTER COLUMN "trigger" TYPE "public"."evaluation_trigger_old" USING "trigger"::"text"::"public"."evaluation_trigger_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."evaluation_trigger"`);
    await queryRunner.query(
      `ALTER TYPE "public"."evaluation_trigger_old" RENAME TO "evaluation_trigger"`,
    );
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "signals_cleared_at"`);
  }
}
