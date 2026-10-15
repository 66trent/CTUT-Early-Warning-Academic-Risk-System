/**
 * npm run demo:load — nạp file của docs/demo-data theo đúng thứ tự trong KET_QUA_MONG_DOI.md, qua
 * ĐÚNG quy trình nhập 2 bước (MinIO + hàng đợi thật; worker xử lý). Chỉ khi DEMO_MODE=true.
 * Mặc định nạp 02–05 (cần đã nạp `01_sinh_vien.csv` + `npm run seed:demo`); `--with-students`
 * nạp cả 01 trước (dùng trong `demo:reset`).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { ImportBatch } from '../src/db/entities/import-batch.entity';
import { ImportBatchStatus } from '../src/db/enums';
import { getEnv } from '../src/lib/env';
import { logger } from '../src/lib/logger';
import { SEED_ADMIN_USER_ID } from '../src/db/seeds/base-seed';
import {
  confirmImportBatch,
  createImportBatch,
} from '../src/modules/data-import/services/import-batch.service';

const STUDENTS_FILE = ['01_sinh_vien.csv', 'STUDENT', null] as const;
const FILES = [
  ['02_HK2_2025_ket_qua_hoc_phan.csv', 'COURSE_RESULT', 'HK2_2025'],
  ['03_HK1_2026_diem_danh_tong_hop.csv', 'ATTENDANCE_SUMMARY', 'HK1_2026'],
  ['04_HK1_2026_lms_bai_kiem_tra.csv', 'LMS_QUIZ', 'HK1_2026'],
  ['05_HK1_2026_ket_qua_giua_ky.csv', 'COURSE_RESULT', 'HK1_2026'],
] as const;

/** Chờ worker xử lý lô tới trạng thái mong muốn (tối đa 60 giây). */
async function waitFor(batchId: string, done: (b: ImportBatch) => boolean): Promise<ImportBatch> {
  const repo = (await getDataSource()).getRepository(ImportBatch);
  for (let i = 0; i < 120; i += 1) {
    const batch = await repo.findOneByOrFail({ id: batchId });
    if (done(batch)) return batch;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Lô ${batchId} chưa xong sau 60 giây — worker có đang chạy không?`);
}

async function main(): Promise<void> {
  if (!getEnv().DEMO_MODE) throw new Error('demo:load chỉ chạy khi DEMO_MODE=true.');
  const files = process.argv.includes('--with-students') ? [STUDENTS_FILE, ...FILES] : FILES;
  for (const [file, dataType, termId] of files) {
    const data = readFileSync(`docs/demo-data/${file}`);
    const { batchId } = await createImportBatch(
      { dataType, termId, parentBatchId: null, fileName: file, data },
      SEED_ADMIN_USER_ID,
    );
    const staged = await waitFor(batchId, (b) => b.status !== ImportBatchStatus.VALIDATING);
    if (staged.status !== ImportBatchStatus.STAGED) {
      throw new Error(`${file}: ${staged.errorMessage ?? staged.status}`);
    }
    await confirmImportBatch(batchId, SEED_ADMIN_USER_ID);
    const loaded = await waitFor(batchId, (b) => b.status !== ImportBatchStatus.STAGED);
    process.stdout.write(
      `demo:load — ${file}: ${loaded.status}, ${loaded.successRows} dòng, ${loaded.errorRows} lỗi\n`,
    );
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error instanceof Error ? error.message : error }, 'demo:load lỗi');
    process.exitCode = 1;
  })
  .finally(() => void closeDataSource().then(() => process.exit()));
