import { readdirSync, readFileSync, statSync } from 'node:fs';
import { expect } from 'vitest';
import { type DataSource } from 'typeorm';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import { ImportBatchStatus, UserAccountStatus, UserRole } from '@/db/enums';
import {
  createImportBatch,
  discardImportBatch,
} from '@/modules/data-import/services/import-batch.service';
import { validateImportBatch } from '@/modules/data-import/services/import-processor.service';
import { cleanupDemo, vn } from './demo-setup';
import { confirmAndLoad, IMPORT_ACTOR, noEnqueue } from './import-helpers';

/**
 * Bộ demo v4 (docs/demo-data/KET_QUA_MONG_DOI.md, Phase 11 đợt 4) đổi sang mã
 * `TST…` để test không đụng dữ liệu thật: lớp `<NGÀNH>2411` → `TST<x>2411`; lớp học phần
 * `010100xxxxxx` → `TST010xxxxxx`; mã học phần ghi rõ `01010xxxxx` → `TST01xxxxx` (khớp mã tự suy).
 */
const DIR = 'docs/demo-data';

/**
 * Khóa thử của lớp năm nhất. Học kỳ đầu khóa = `HK1_{khóa}` (docs/rules/09), nên học kỳ thử phải
 * mang đúng mã này (không có tiền tố TST, cleanupDemoV4 dọn riêng).
 */
const TEST_FRESHMAN_COHORT = '2925';

export const V4 = {
  hk2: 'TSTHK2_24',
  hk3: 'TSTHK3_24',
  hk1: `HK1_${TEST_FRESHMAN_COHORT}`,
} as const;

export const V4_CLASSES = {
  CNTT2411: { test: 'TSTC2411', major: 'CNTT', advisor: 'TSTGV4C', cohort: '2024' },
  KTPM2411: { test: 'TSTK2411', major: 'KTPM', advisor: 'TSTGV4K', cohort: '2024' },
  HTTT2411: { test: 'TSTT2411', major: 'HTTT', advisor: 'TSTGV4T', cohort: '2024' },
  KHMT2411: { test: 'TSTM2411', major: 'KHMT', advisor: 'TSTGV4M', cohort: '2024' },
  KHDL2411: { test: 'TSTD2411', major: 'KHDL', advisor: 'TSTGV4D', cohort: '2024' },
  KTPM2511: { test: 'TSTK2511', major: 'KTPM', advisor: 'TSTGV4N', cohort: TEST_FRESHMAN_COHORT },
} as const;
export type V4Class = keyof typeof V4_CLASSES;

/** MSSV thử của sinh viên `n` (901–920) lớp demo `cls`. */
export const v4sv = (cls: V4Class, n: number) => `${V4_CLASSES[cls].test}${n}`;

/** Mã học phần thử (khớp mã tự suy từ lớp học phần thử). */
export const v4course = (code: string) => code.replace(/^01010(\d{5})$/, 'TST01$1');

export function toTest(csv: string): string {
  let out = csv
    .replace(/010100(\d{6})/g, 'TST010$1')
    .replace(/(?<![0-9A-Z])01010(\d{5})(?![0-9])/g, 'TST01$1');
  for (const [real, { test }] of Object.entries(V4_CLASSES)) {
    out = out.replaceAll(real, test).replaceAll(real.toLowerCase(), test.toLowerCase());
  }
  return out;
}

/** File của 1 bước: thư mục → mọi file `.csv` theo tên; tên file thêm tiền tố `tst-` (dọn dẹp). */
function filesOf(entry: string): { fileName: string; data: Buffer }[] {
  const path = `${DIR}/${entry}`;
  const names = statSync(path).isDirectory()
    ? readdirSync(path)
        .filter((f) => f.endsWith('.csv'))
        .sort()
        .map((f) => `${entry}/${f}`)
    : [entry];
  return names.map((name) => ({
    fileName: `tst-${name.split('/').at(-1) ?? name}`,
    data: Buffer.from(toTest(readFileSync(`${DIR}/${name}`, 'utf8')), 'utf8'),
  }));
}

/** Nạp 1 bước (1 lô, nhiều file) qua quy trình 2 bước; khẳng định 0 dòng lỗi. */
export async function loadStep(
  ds: DataSource,
  entry: string,
  dataType: string,
  termId: string | null,
): Promise<ImportBatch> {
  const { batchId } = await createImportBatch(
    { dataType, termId, parentBatchId: null, files: filesOf(entry) },
    IMPORT_ACTOR,
    noEnqueue,
  );
  await validateImportBatch(batchId);
  const staged = await ds.getRepository(ImportBatch).findOneByOrFail({ id: batchId });
  expect(staged.errorRows, entry).toBe(0);
  expect(staged.status, `${entry}: ${staged.errorMessage ?? ''}`).toBe('STAGED');
  return confirmAndLoad(ds, batchId);
}

/** Kiểm tra 1 file minh họa lỗi (chỉ xem trước, không nhập); trả lý do lỗi + mã cảnh báo. */
export async function stageSample(
  ds: DataSource,
  file: string,
  dataType: string,
  termId: string | null,
  courseId: string | null = null,
): Promise<{ reasons: string[]; warnings: string[] }> {
  const { batchId } = await createImportBatch(
    { dataType, termId, courseId, parentBatchId: null, files: filesOf(`minh-hoa-loi/${file}`) },
    IMPORT_ACTOR,
    noEnqueue,
  );
  await validateImportBatch(batchId);
  const batch = await ds.getRepository(ImportBatch).findOneByOrFail({ id: batchId });
  const errors = await ds.getRepository(ImportErrorRow).findBy({ importBatchId: batchId });
  if (batch.status === ImportBatchStatus.STAGED) await discardImportBatch(batchId, IMPORT_ACTOR);
  return {
    reasons: errors.map((e) => e.errorReason).sort(),
    warnings: (batch.warnings ?? []).map((w) => w.code).sort(),
  };
}

/** Thứ tự nhập của KET_QUA_MONG_DOI.md v4 (bước 2–9). */
export const V4_STEPS = [
  ['02_HK2_2024_ket_qua', 'COURSE_RESULT', V4.hk2],
  ['03_HK3_2024_ket_qua', 'COURSE_RESULT', V4.hk3],
  ['04_HK1_2025_diem_danh_dot_1', 'ATTENDANCE_SUMMARY', V4.hk1],
  ['05_HK1_2025_diem_danh_dot_2', 'ATTENDANCE_SUMMARY', V4.hk1],
  ['06_HK1_2025_trac_nghiem', 'LMS_QUIZ', V4.hk1],
  ['07_HK1_2025_thuc_hanh', 'LMS_ASSIGNMENT', V4.hk1],
  ['08_HK1_2025_ket_qua_logic_hoc', 'COURSE_RESULT', V4.hk1],
  ['09_HK1_2025_ket_qua_cuoi_ky', 'COURSE_RESULT', V4.hk1],
] as const;

export async function cleanupDemoV4(ds: DataSource): Promise<void> {
  const runs = `SELECT id FROM evaluation_runs WHERE term_id = '${V4.hk1}'`;
  await ds.query(`DELETE FROM rule_triggers WHERE evaluation_run_id IN (${runs})`);
  await ds.query(`DELETE FROM risk_score_logs WHERE evaluation_run_id IN (${runs})`);
  await cleanupDemo(ds);
  await ds.query(`DELETE FROM evaluation_runs WHERE term_id = '${V4.hk1}'`);
  await ds.query(`DELETE FROM terms WHERE term_id = '${V4.hk1}'`);
  await ds.query(`DELETE FROM users WHERE user_id LIKE 'TSTGV4%'`);
}

/**
 * Dựng bộ v4 thử: 6 Cố vấn học tập + 6 lớp (có ngành) + 3 học kỳ, rồi nhập TOÀN BỘ file (bước 1–9),
 * 3 mốc chạy do test tự gọi (mốc tính đến chống rò rỉ thời gian).
 * Học kỳ trước thử bắt đầu muộn hơn học kỳ thật 1 ngày để luôn là "học kỳ liền trước" của học kỳ
 * thử theo `Term.startDate`, kể cả khi DB đang có bộ demo thật.
 */
export async function setupDemoV4(ds: DataSource): Promise<void> {
  await cleanupDemoV4(ds);
  const classes = Object.entries(V4_CLASSES);
  await ds.getRepository(User).insert(
    classes.map(([, c]) => ({
      userId: c.advisor,
      fullName: `Cố vấn ${c.advisor}`,
      email: `${c.advisor.toLowerCase()}@ctuet.edu.vn`,
      role: UserRole.ADVISOR,
      accountStatus: UserAccountStatus.ACTIVE,
      authUserId: null,
    })),
  );
  await ds.getRepository(AdministrativeClass).insert(
    classes.map(([real, c]) => ({
      classId: c.test,
      className: `Lớp thử ${real}`,
      departmentId: 'K.CNTT',
      majorId: c.major,
      cohortYear: c.cohort,
      advisorId: c.advisor,
    })),
  );
  const term = (termId: string, start: string, end: string, year: string) => ({
    termId,
    termName: `Học kỳ thử ${termId}`,
    academicYear: year,
    startDate: vn(start),
    endDate: vn(end, '23:59:59'),
    isCurrent: false,
  });
  await ds
    .getRepository(Term)
    .insert([
      term(V4.hk2, '2025-01-07', '2025-04-27', '2024-2025'),
      term(V4.hk3, '2025-05-05', '2025-08-10', '2024-2025'),
      term(V4.hk1, '2025-08-18', '2025-12-28', '2025-2026'),
    ]);
  await loadStep(ds, '01_sinh_vien.csv', 'STUDENT', null);
  for (const [entry, type, termId] of V4_STEPS) await loadStep(ds, entry, type, termId);
}
