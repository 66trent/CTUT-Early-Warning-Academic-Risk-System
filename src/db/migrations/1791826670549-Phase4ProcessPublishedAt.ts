import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4ProcessPublishedAt1791826670549 implements MigrationInterface {
  name = 'Phase4ProcessPublishedAt1791826670549';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_results" ADD "process_published_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "course_results" DROP COLUMN "process_published_at"`);
  }
}
