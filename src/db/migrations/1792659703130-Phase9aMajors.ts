import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase9aMajors1792659703130 implements MigrationInterface {
  name = 'Phase9aMajors1792659703130';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "majors" ("major_id" character varying(10) NOT NULL, "major_name" character varying(150) NOT NULL, "department_id" character varying(10) NOT NULL, CONSTRAINT "PK_d535afcba79d9c733217b8956d7" PRIMARY KEY ("major_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3a4932d07fd4b560a95fc6b207" ON "majors" ("department_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "administrative_classes" ADD "major_id" character varying(10)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29059b7007323219ac5dc579f7" ON "administrative_classes" ("major_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "majors" ADD CONSTRAINT "FK_3a4932d07fd4b560a95fc6b2073" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrative_classes" ADD CONSTRAINT "FK_29059b7007323219ac5dc579f79" FOREIGN KEY ("major_id") REFERENCES "majors"("major_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "administrative_classes" DROP CONSTRAINT "FK_29059b7007323219ac5dc579f79"`,
    );
    await queryRunner.query(
      `ALTER TABLE "majors" DROP CONSTRAINT "FK_3a4932d07fd4b560a95fc6b2073"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_29059b7007323219ac5dc579f7"`);
    await queryRunner.query(`ALTER TABLE "administrative_classes" DROP COLUMN "major_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3a4932d07fd4b560a95fc6b207"`);
    await queryRunner.query(`DROP TABLE "majors"`);
  }
}
