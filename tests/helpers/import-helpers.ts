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
 * Bộ demo v2 (1 lớp KTPM2411) — giữ làm FIXTURE ổn định cho các test tính năng (tổng quan, màn
 * Cố vấn học tập, Phase 7…). Nghiệm thu bộ demo hiện hành v3: `tests/helpers/demo-v3.ts`.
 */
export const DEMO_V2_DIR = 'docs/demo-data/_luu-tru-v2';

/**
 * Bản sao file demo đổi sang mã `TST…` — test không đụng dữ liệu thật trong DB:
 * KTPM2411 → TSTK2411 (cả mssv, lớp, email).
 */
export function demoStudentsCsv(): string {
  return readFileSync(`${DEMO_V2_DIR}/01_sinh_vien.csv`, 'utf8')
    .replace(/KTPM2411/g, 'TSTK2411')
    .replace(/ktpm2411/g, 'tstk2411');
}

/** Lớp thử: TSTK2411 (vai KTPM2411, CVHT A) và TSTH2411 (CVHT B, chưa có sinh viên). */
export const TEST_CLASSES = ['TSTK2411', 'TSTH2411'] as const;

/**
 * File demo học tập (02–06) đổi sang mã `TST…`: sinh viên như `demoStudentsCsv()`, mã lớp học
 * phần 010100xxxxxx → TST010xxxxxx (mã học phần tự suy → TST0102408… — dọn được theo tiền tố).
 */
export function demoAcademicCsv(fileName: string): string {
  return readFileSync(`${DEMO_V2_DIR}/${fileName}`, 'utf8')
    .replace(/KTPM2411/g, 'TSTK2411')
    .replace(/010100(\d{6})/g, 'TST010$1');
}

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
  await loadImportBatch(batchId, { retried: false, afterReconciled: noEnqueue });
  return ds.getRepository(ImportBatch).findOneByOrFail({ id: batchId });
}

/** Dọn lô nhập của test (tên file bắt đầu bằng `tst-`) cùng dữ liệu nguồn và Enrollment lô tạo. */
export async function cleanupImportBatches(ds: DataSource): Promise<void> {
  // Cảnh báo của sinh viên thử (Phase 5) trước, vì trỏ tới sinh viên / lần chạy / RiskScore.
  const tstAlerts = `SELECT alert_id FROM alerts WHERE student_id LIKE 'TST%'`;
  await ds.query(`DELETE FROM notifications WHERE alert_id IN (${tstAlerts})`);
  await ds.query(`DELETE FROM interventions WHERE alert_id IN (${tstAlerts})`);
  await ds.query(`DELETE FROM alert_state_history WHERE alert_id IN (${tstAlerts})`);
  await ds.query(`UPDATE rule_triggers SET alert_id = NULL WHERE alert_id IN (${tstAlerts})`);
  await ds.query(
    `DELETE FROM audit_logs WHERE target_type = 'Alert' AND target_id IN (SELECT alert_id::text FROM alerts WHERE student_id LIKE 'TST%')`,
  );
  await ds.query(`DELETE FROM alerts WHERE student_id LIKE 'TST%'`);
  const tstBatches = `SELECT id FROM import_batches WHERE file_name LIKE 'tst-%'`;
  // Lần chạy đánh giá trên học kỳ thử hoặc do lô thử kích hoạt, cùng kết quả của chúng.
  const tstRuns = `SELECT id FROM evaluation_runs WHERE term_id LIKE 'TST%' OR import_batch_id IN (${tstBatches})`;
  await ds.query(`DELETE FROM rule_triggers WHERE evaluation_run_id IN (${tstRuns})`);
  await ds.query(`DELETE FROM risk_score_logs WHERE evaluation_run_id IN (${tstRuns})`);
  await ds.query(`DELETE FROM evaluation_runs WHERE id IN (${tstRuns})`);
  for (const table of [
    'attendance_summaries',
    'lms_quiz_attempts',
    'lms_assignment_submissions',
    'course_results',
    'lms_activities',
  ]) {
    await ds.query(`DELETE FROM ${table} WHERE import_batch_id IN (${tstBatches})`);
  }
  await ds.query(`DELETE FROM enrollments WHERE first_seen_batch_id IN (${tstBatches})`);
  await ds.query(
    `DELETE FROM audit_logs WHERE target_type = 'ImportBatch'
       AND target_id IN (SELECT id::text FROM import_batches WHERE file_name LIKE 'tst-%')`,
  );
  await ds.query(`UPDATE import_batches SET parent_batch_id = NULL WHERE file_name LIKE 'tst-%'`);
  await ds.query(`DELETE FROM import_batches WHERE file_name LIKE 'tst-%'`);
}
