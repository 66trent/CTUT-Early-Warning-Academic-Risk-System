import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3aImport1791807992637 implements MigrationInterface {
  name = 'Phase3aImport1791807992637';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."import_source" AS ENUM('FILE')`);
    await queryRunner.query(
      `CREATE TYPE "public"."import_batch_status" AS ENUM('UPLOADING', 'VALIDATING', 'STAGED', 'LOADED', 'RECONCILED', 'REJECTED', 'DISCARDED', 'ROLLED_BACK')`,
    );
    await queryRunner.query(
      `CREATE TABLE "import_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "data_type" character varying(40) NOT NULL, "term_id" character varying(10), "source" "public"."import_source" NOT NULL, "file_name" character varying(255) NOT NULL, "source_checksum" character varying(64) NOT NULL, "performed_by" character varying(20) NOT NULL, "status" "public"."import_batch_status" NOT NULL, "total_rows" integer NOT NULL DEFAULT '0', "success_rows" integer NOT NULL DEFAULT '0', "error_rows" integer NOT NULL DEFAULT '0', "warnings" jsonb, "summary" jsonb, "error_message" text, "parent_batch_id" uuid, "original_file_path" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "staged_at" TIMESTAMP WITH TIME ZONE, "loaded_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6162597a2576c03e04bb2c1a2dd" PRIMARY KEY ("id"))`,
    );
    // Chống nạp trùng chỉ với lô còn hiệu lực (docs/rules/12) — viết tay vì có biểu thức COALESCE.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_import_batches_live_checksum" ON "import_batches" ("source_checksum", "data_type", COALESCE("term_id", '')) WHERE "status" NOT IN ('REJECTED', 'DISCARDED', 'ROLLED_BACK')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_85c018b5c0f3f16f34a3385f71" ON "import_batches" ("data_type", "term_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cafcaccf1d2d925a8583a9c9b9" ON "import_batches" ("status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "import_error_rows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "import_batch_id" uuid NOT NULL, "source_row_number" integer NOT NULL, "raw_data" jsonb NOT NULL, "error_reason" character varying(40) NOT NULL, "error_detail" character varying(255), "resolved" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a649f5da66a6fb79167776a1f52" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c600e45b6eb330fdb530a81391" ON "import_error_rows" ("import_batch_id", "source_row_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_af8a214dab45d70f643b40d522" ON "import_error_rows" ("import_batch_id", "resolved") `,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" ADD CONSTRAINT "FK_074aa45833a647b73fe9bf3abc2" FOREIGN KEY ("term_id") REFERENCES "terms"("term_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" ADD CONSTRAINT "FK_aaac049dc5c29360db643827926" FOREIGN KEY ("performed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" ADD CONSTRAINT "FK_4d113cf1c2d296ade83ff186a25" FOREIGN KEY ("parent_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_error_rows" ADD CONSTRAINT "FK_02dcc3a4554da5fa5487a5a38e3" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "import_error_rows" DROP CONSTRAINT "FK_02dcc3a4554da5fa5487a5a38e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" DROP CONSTRAINT "FK_4d113cf1c2d296ade83ff186a25"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" DROP CONSTRAINT "FK_aaac049dc5c29360db643827926"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_batches" DROP CONSTRAINT "FK_074aa45833a647b73fe9bf3abc2"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_af8a214dab45d70f643b40d522"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c600e45b6eb330fdb530a81391"`);
    await queryRunner.query(`DROP TABLE "import_error_rows"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cafcaccf1d2d925a8583a9c9b9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_85c018b5c0f3f16f34a3385f71"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_import_batches_live_checksum"`);
    await queryRunner.query(`DROP TABLE "import_batches"`);
    await queryRunner.query(`DROP TYPE "public"."import_batch_status"`);
    await queryRunner.query(`DROP TYPE "public"."import_source"`);
  }
}
