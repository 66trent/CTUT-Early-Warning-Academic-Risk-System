/**
 * npm run demo:scenario -- <số> [--wave <n>] [--evaluate]
 * Nạp 1 kịch bản nhỏ trong docs/demo-data/kich-ban/<số>-…/ qua ĐÚNG quy trình nhập 2 bước (worker
 * xử lý), chồng lên bộ demo chính. `--wave 2`: nạp đợt 2 (kịch bản có nhiều đợt). `--evaluate`:
 * đưa luôn các lần chạy đánh giá của đợt vào hàng đợi (mốc asOf ghi trong scenario.json).
 * Chỉ khi DEMO_MODE=true. Các bước trình bày + kết quả mong đợi: README.md của từng kịch bản.
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { ImportBatch } from '../src/db/entities/import-batch.entity';
import { EvaluationTrigger, ImportBatchStatus } from '../src/db/enums';
import { SEED_ADMIN_USER_ID } from '../src/db/seeds/base-seed';
import { vnEndOfDay } from '../src/lib/dates';
import { getEnv } from '../src/lib/env';
import {
  confirmImportBatch,
  createImportBatch,
} from '../src/modules/data-import/services/import-batch.service';
import { requestEvaluation } from '../src/modules/rule-engine/services/evaluation-run.service';

const ROOT = path.resolve('docs/demo-data/kich-ban');

interface Manifest {
  id: string;
  title: string;
  files: {
    file: string;
    dataType: string;
    termId: string | null;
    wave?: number;
    asXlsx?: boolean;
  }[];
  evaluations: { termId: string; asOf: string; afterWave?: number }[];
}

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function toXlsx(csv: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Dữ liệu');
  for (const line of csv.replace(/^﻿/, '').trim().split(/\r?\n/)) sheet.addRow(line.split(','));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

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
  if (!getEnv().DEMO_MODE) throw new Error('demo:scenario chỉ chạy khi DEMO_MODE=true.');
  const id = process.argv
    .slice(2)
    .find((a) => /^\d{1,2}$/.test(a))
    ?.padStart(2, '0');
  const dir = readdirSync(ROOT).find((d) => id && d.startsWith(`${id}-`));
  if (!dir) {
    throw new Error(
      `Cách dùng: npm run demo:scenario -- <số>. Có: ${readdirSync(ROOT).join(', ')}`,
    );
  }
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, dir, 'scenario.json'), 'utf8'),
  ) as Manifest;
  const wave = Number(arg('--wave') ?? 1);
  process.stdout.write(`Kịch bản ${manifest.id} — ${manifest.title} (đợt ${wave})\n`);

  for (const f of manifest.files.filter((x) => (x.wave ?? 1) === wave)) {
    const csv = readFileSync(path.join(ROOT, dir, f.file), 'utf8');
    const fileName = f.asXlsx ? f.file.replace(/\.csv$/, '.xlsx') : f.file;
    const data = f.asXlsx ? await toXlsx(csv) : Buffer.from(csv, 'utf8');
    const { batchId } = await createImportBatch(
      { dataType: f.dataType, termId: f.termId, parentBatchId: null, fileName, data },
      SEED_ADMIN_USER_ID,
    );
    const staged = await waitFor(batchId, (b) => b.status !== ImportBatchStatus.VALIDATING);
    if (staged.status !== ImportBatchStatus.STAGED) {
      throw new Error(`${fileName}: ${staged.errorMessage ?? staged.status}`);
    }
    await confirmImportBatch(batchId, SEED_ADMIN_USER_ID);
    const loaded = await waitFor(batchId, (b) => b.status !== ImportBatchStatus.STAGED);
    process.stdout.write(
      `  ${fileName}: ${loaded.status}, ${loaded.successRows} dòng nạp, ${loaded.errorRows} dòng lỗi\n`,
    );
  }

  for (const e of manifest.evaluations.filter((x) => (x.afterWave ?? 1) === wave)) {
    if (process.argv.includes('--evaluate')) {
      await requestEvaluation({
        termId: e.termId,
        courseId: null,
        trigger: EvaluationTrigger.MANUAL,
        asOf: vnEndOfDay(e.asOf),
        actorId: SEED_ADMIN_USER_ID,
        importBatchId: null,
      });
      process.stdout.write(`  Đã đưa vào hàng đợi: chạy đánh giá ${e.termId}, mốc ${e.asOf}\n`);
    } else {
      process.stdout.write(
        `  Bước tiếp: Admin → Chạy đánh giá → ${e.termId}, mốc dữ liệu ${e.asOf}\n`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void closeDataSource().then(() => process.exit()));
