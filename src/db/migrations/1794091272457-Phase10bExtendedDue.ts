import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase10bExtendedDue1794091272457 implements MigrationInterface {
  name = 'Phase10bExtendedDue1794091272457';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" ADD "extended_due_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_submissions" DROP COLUMN "extended_due_at"`,
    );
  }
}
