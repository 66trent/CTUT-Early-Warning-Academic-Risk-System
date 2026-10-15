import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { type DataSource } from 'typeorm';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { MemoryStorage, setStorage } from '@/lib/storage';
import {
  confirmImportBatch,
  createImportBatch,
} from '@/modules/data-import/services/import-batch.service';
import {
  loadImportBatch,
  validateImportBatch,
} from '@/modules/data-import/services/import-processor.service';

/** Test không cần Redis/MinIO: không đưa job vào hàng đợi, lưu file trong bộ nhớ. */
export const noEnqueue = () => Promise.resolve();
export const IMPORT_ACTOR = 'ADMIN';

export function useMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  setStorage(storage);
  return storage;
}

/**
 * Bản sao file demo đổi sang mã `TST…` — test không đụng dữ liệu thật trong DB:
 * KTPM2311 → TSTK2311, KHMT2311 → TSTH2311 (cả mssv, lớp, email).
 */
export function demoStudentsCsv(): string {
  return readFileSync('docs/demo-data/01_sinh_vien.csv', 'utf8')
    .replace(/KTPM2311/g, 'TSTK2311')
    .replace(/KHMT2311/g, 'TSTH2311')
    .replace(/ktpm2311/g, 'tstk2311')
    .replace(/khmt2311/g, 'tsth2311');
}

export const TEST_CLASSES = ['TSTK2311', 'TSTH2311'] as const;

export async function csvToXlsx(csv: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sinh viên');
  for (const line of csv.replace(/^﻿/, '').trim().split(/\r?\n/)) sheet.addRow(line.split(','));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Tải lên + kiểm tra (bước 1). Trả về lô sau khi kiểm tra. */
export async function uploadAndValidate(
  ds: DataSource,
  fileName: string,
  content: string | Buffer,
  dataType = 'STUDENT',
  termId: string | null = null,
): Promise<ImportBatch> {
  const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const { batchId } = await createImportBatch(
    { dataType, termId, parentBatchId: null, fileName, data },
    IMPORT_ACTOR,
    noEnqueue,
  );
  await validateImportBatch(batchId);
  return ds.getRepository(ImportBatch).findOneByOrFail({ id: batchId });
}

/** Xác nhận + nạp (bước 2). */
export async function confirmAndLoad(ds: DataSource, batchId: string): Promise<ImportBatch> {
  await confirmImportBatch(batchId, IMPORT_ACTOR, noEnqueue);
  await loadImportBatch(batchId, { retried: false });
  return ds.getRepository(ImportBatch).findOneByOrFail({ id: batchId });
}

/** Dọn lô nhập của test (tên file bắt đầu bằng `tst-`). */
export async function cleanupImportBatches(ds: DataSource): Promise<void> {
  await ds.query(
    `DELETE FROM audit_logs WHERE target_type = 'ImportBatch'
       AND target_id IN (SELECT id::text FROM import_batches WHERE file_name LIKE 'tst-%')`,
  );
  await ds.query(`UPDATE import_batches SET parent_batch_id = NULL WHERE file_name LIKE 'tst-%'`);
  await ds.query(`DELETE FROM import_batches WHERE file_name LIKE 'tst-%'`);
}
