import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase8fImportFiles1792505510980 implements MigrationInterface {
  name = 'Phase8fImportFiles1792505510980';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "import_batch_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "import_batch_id" uuid NOT NULL, "file_order" integer NOT NULL, "file_name" character varying(255) NOT NULL, "source_checksum" character varying(64) NOT NULL, "original_file_path" character varying(255) NOT NULL, "size_bytes" integer NOT NULL, "total_rows" integer NOT NULL DEFAULT '0', "success_rows" integer NOT NULL DEFAULT '0', "error_rows" integer NOT NULL DEFAULT '0', "course_ids" character varying(20) array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_38b501fd31c547f9eb197092a25" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_05dba53d5ad88fc12611fed267" ON "import_batch_files" ("source_checksum") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6358ac26b6390023896de2d414" ON "import_batch_files" ("import_batch_id", "file_order") `,
    );
    await queryRunner.query(
      `ALTER TABLE "import_error_rows" ADD "source_file_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batch_files" ADD CONSTRAINT "FK_41d1881e31c03b7e11382db5185" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Lô trước 8f: 1 file / lô — điền từ cột của import_batches (docs/rules/12).
    await queryRunner.query(
      `INSERT INTO "import_batch_files" ("import_batch_id", "file_order", "file_name", "source_checksum", "original_file_path", "size_bytes", "total_rows", "success_rows", "error_rows", "created_at") SELECT "id", 1, "file_name", "source_checksum", "original_file_path", 0, "total_rows", "success_rows", "error_rows", "created_at" FROM "import_batches"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "import_batch_files" DROP CONSTRAINT "FK_41d1881e31c03b7e11382db5185"`,
    );
    await queryRunner.query(`ALTER TABLE "import_error_rows" DROP COLUMN "source_file_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6358ac26b6390023896de2d414"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_05dba53d5ad88fc12611fed267"`);
    await queryRunner.query(`DROP TABLE "import_batch_files"`);
  }
}
