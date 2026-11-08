import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase10bMoodleSync1794090492630 implements MigrationInterface {
  name = 'Phase10bMoodleSync1794090492630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "moodle_course_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "moodle_course_id" integer NOT NULL, "term_id" character varying(10) NOT NULL, "section_code" character varying(30) NOT NULL, "course_id" character varying(20) NOT NULL, "course_name" character varying(150) NOT NULL, "moodle_shortname" character varying(255) NOT NULL, "moodle_fullname" character varying(255) NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "total_periods_override" integer, "last_sync_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "unknown_students" jsonb NOT NULL DEFAULT '[]', "updated_by" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fc0b75e5fb5d2ea82fcb27936c1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_da4dafad44c9702ba2355fdad4" ON "moodle_course_links" ("moodle_course_id", "term_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "moodle_sync_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "term_id" character varying(10) NOT NULL, "trigger" character varying(20) NOT NULL, "requested_by" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "batch_ids" jsonb NOT NULL DEFAULT '{}', "stats" jsonb, "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f0b51836493e4fb2c9e23b5ba4b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_345b7780658c282be16af0ee00" ON "moodle_sync_runs" ("term_id", "created_at") `,
    );
    await queryRunner.query(`ALTER TYPE "public"."import_source" RENAME TO "import_source_old"`);
    await queryRunner.query(`CREATE TYPE "public"."import_source" AS ENUM('FILE', 'MOODLE')`);
    await queryRunner.query(
      `ALTER TABLE "import_batches" ALTER COLUMN "source" TYPE "public"."import_source" USING "source"::"text"::"public"."import_source"`,
    );
    await queryRunner.query(`DROP TYPE "public"."import_source_old"`);
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" ADD CONSTRAINT "FK_8915f02ec4e485f41d09e044559" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_sync_runs" ADD CONSTRAINT "FK_e5d26d76748c6b640ef42ddbe29" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "moodle_sync_runs" DROP CONSTRAINT "FK_e5d26d76748c6b640ef42ddbe29"`,
    );
    await queryRunner.query(
      `ALTER TABLE "moodle_course_links" DROP CONSTRAINT "FK_8915f02ec4e485f41d09e044559"`,
    );
    await queryRunner.query(`CREATE TYPE "public"."import_source_old" AS ENUM('FILE')`);
    await queryRunner.query(
      `ALTER TABLE "import_batches" ALTER COLUMN "source" TYPE "public"."import_source_old" USING "source"::"text"::"public"."import_source_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."import_source"`);
    await queryRunner.query(`ALTER TYPE "public"."import_source_old" RENAME TO "import_source"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_345b7780658c282be16af0ee00"`);
    await queryRunner.query(`DROP TABLE "moodle_sync_runs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_da4dafad44c9702ba2355fdad4"`);
    await queryRunner.query(`DROP TABLE "moodle_course_links"`);
  }
}
