import { readdirSync, readFileSync, statSync } from 'node:fs';
import { expect } from 'vitest';
import { type DataSource } from 'typeorm';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { createImportBatch } from '@/modules/data-import/services/import-batch.service';
import { validateImportBatch } from '@/modules/data-import/services/import-processor.service';
import { cleanupDemo, vn } from './demo-setup';
import { confirmAndLoad, IMPORT_ACTOR, noEnqueue } from './import-helpers';

/**
 * Bộ demo v3 (docs/demo-data/KET_QUA_MONG_DOI.md — toàn Khoa CNTT khóa 2024, Phase 9b) đổi sang mã
 * `TST…` để test không đụng dữ liệu thật: lớp `<NGÀNH>2411` → `TST<x>2411`; lớp học phần
 * `010100xxxxxx` → `TST010xxxxxx`; mã học phần ghi rõ `01010xxxxx` → `TST01xxxxx` (khớp mã tự suy).
 */
const DIR = 'docs/demo-data';

export const V3 = {
  hk3: 'TSTHK3_24',
  hk1: 'TSTHK1_25',
} as const;

export const V3_CLASSES = {
  CNTT2411: { test: 'TSTC2411', major: 'CNTT', advisor: 'TSTGV3C' },
  KTPM2411: { test: 'TSTK2411', major: 'KTPM', advisor: 'TSTGV3K' },
  HTTT2411: { test: 'TSTT2411', major: 'HTTT', advisor: 'TSTGV3T' },
  KHMT2411: { test: 'TSTM2411', major: 'KHMT', advisor: 'TSTGV3M' },
  KHDL2411: { test: 'TSTD2411', major: 'KHDL', advisor: 'TSTGV3D' },
} as const;
export type V3Class = keyof typeof V3_CLASSES;

/** MSSV thử của sinh viên `n` (901–920) lớp demo `cls`. */
export const v3sv = (cls: V3Class, n: number) => `${V3_CLASSES[cls].test}${n}`;

/** Mã học phần thử (khớp mã tự suy từ lớp học phần thử). */
export const v3course = (code: string) => code.replace(/^01010(\d{5})$/, 'TST01$1');

export function toTest(csv: string): string {
  let out = csv
    .replace(/010100(\d{6})/g, 'TST010$1')
    .replace(/(?<![0-9A-Z])01010(\d{5})(?![0-9])/g, 'TST01$1');
  for (const [real, { test }] of Object.entries(V3_CLASSES)) {
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

/** Thứ tự nạp của KET_QUA_MONG_DOI.md v3 (bước 2–7). */
export const V3_STEPS = [
  ['02_HK3_2024_ket_qua', 'COURSE_RESULT', V3.hk3],
  ['03_HK1_2025_diem_danh', 'ATTENDANCE_SUMMARY', V3.hk1],
  ['04_HK1_2025_trac_nghiem', 'LMS_QUIZ', V3.hk1],
  ['05_HK1_2025_thuc_hanh', 'LMS_ASSIGNMENT', V3.hk1],
  ['06_HK1_2025_ket_qua_logic_hoc', 'COURSE_RESULT', V3.hk1],
  ['07_HK1_2025_ket_qua_cuoi_ky', 'COURSE_RESULT', V3.hk1],
] as const;

export async function cleanupDemoV3(ds: DataSource): Promise<void> {
  await cleanupDemo(ds);
  await ds.query(`DELETE FROM users WHERE user_id LIKE 'TSTGV3%'`);
}

/**
 * Dựng bộ v3 thử: 5 Cố vấn học tập + 5 lớp (có ngành) + 2 học kỳ, rồi nạp TOÀN BỘ file (bước 1–7)
 * — 3 mốc chạy do test tự gọi (mốc asOf chống rò rỉ thời gian).
 * Học kỳ trước thử bắt đầu 05/05 (muộn hơn HK3_2024 thật 1 ngày) để luôn là "học kỳ liền trước"
 * của học kỳ thử theo `Term.startDate`, kể cả khi DB đang có bộ demo thật.
 */
export async function setupDemoV3(ds: DataSource): Promise<void> {
  await cleanupDemoV3(ds);
  const classes = Object.entries(V3_CLASSES);
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
      cohortYear: '2024',
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
      term(V3.hk3, '2025-05-05', '2025-08-10', '2024-2025'),
      term(V3.hk1, '2025-08-18', '2025-12-28', '2025-2026'),
    ]);
  await loadStep(ds, '01_sinh_vien.csv', 'STUDENT', null);
  for (const [entry, type, termId] of V3_STEPS) await loadStep(ds, entry, type, termId);
}
