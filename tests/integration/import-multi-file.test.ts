import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { ImportBatchFile } from '@/db/entities/import-batch-file.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { Term } from '@/db/entities/term.entity';
import { ImportBatchStatus } from '@/db/enums';
import { firstPage } from '@/lib/list-params';
import { buildErrorCsv } from '@/modules/data-import/services/error-file.service';
import {
  addImportFile,
  beginImportUpload,
  createImportBatch,
  discardImportBatch,
  expireStagedBatches,
  finishImportUpload,
  rollbackImportBatch,
} from '@/modules/data-import/services/import-batch.service';
import { validateImportBatch } from '@/modules/data-import/services/import-processor.service';
import {
  getImportBatchDetail,
  listErrorRows,
  listImportBatches,
} from '@/modules/data-import/services/import-query.service';
import { getDataFreshness } from '@/modules/admin/services/overview.service';
import { cleanupDemo, DEMO, vn } from '../helpers/demo-setup';
import {
  confirmAndLoad,
  demoAcademicCsv,
  demoStudentsCsv,
  IMPORT_ACTOR,
  noEnqueue,
  TEST_CLASSES,
  uploadAndValidate,
  useMemoryStorage,
} from '../helpers/import-helpers';

/** Nạp nhiều file 1 lần (Phase 8f, docs/rules/12): 1 lô, xem trước từng file, trùng xuyên file. */
let ds: DataSource;
const HK1: string = DEMO.hk1;
const ATTENDANCE = 'ATTENDANCE_SUMMARY';
const meta = { dataType: ATTENDANCE, termId: HK1, parentBatchId: null };

/** File điểm danh demo tách theo lớp học phần (trường xuất 1 file / lớp học phần / lần). */
function attendanceBySection(): Map<string, string[]> {
  const [header, ...rows] = demoAcademicCsv('02_HK1_2025_diem_danh.csv')
    .replace(/^﻿/, '')
    .trim()
    .split(/\r?\n/);
  const bySection = new Map<string, string[]>();
  for (const row of rows) {
    const section = row.split(',')[3] ?? '';
    bySection.set(section, [...(bySection.get(section) ?? []), row]);
  }
  return new Map([...bySection].map(([k, v]) => [k, [header ?? '', ...v]]));
}

const toFile = (name: string, lines: string[]) => ({
  fileName: name,
  data: Buffer.from(lines.join('\n'), 'utf8'),
});

/** DTO trả cho Client Component phải là object thuần (docs/rules/01). */
function expectPlain(value: unknown) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
}

async function batchOf(batchId: string) {
  return ds.getRepository(ImportBatch).findOneByOrFail({ id: batchId });
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await cleanupDemo(ds);
  await ds.getRepository(AdministrativeClass).insert(
    TEST_CLASSES.map((classId) => ({
      classId,
      className: `Lớp thử ${classId}`,
      departmentId: 'K.CNTT',
      cohortYear: '2024',
      advisorId: null,
    })),
  );
  await ds.getRepository(Term).insert({
    termId: HK1,
    termName: `Học kỳ thử ${HK1}`,
    academicYear: '2025-2026',
    startDate: vn('2025-08-18'),
    endDate: vn('2025-12-28', '23:59:59'),
    isCurrent: false,
  });
  const students = await uploadAndValidate(ds, 'tst-01_sinh_vien.csv', demoStudentsCsv());
  await confirmAndLoad(ds, students.id);
});

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Nạp 3 file điểm danh 1 lần → 1 lô', () => {
  let batchId = '';

  it('xem trước: 120 dòng / 3 file, bảng từng file có học phần, thẻ học phần gộp cả lô', async () => {
    const files = [...attendanceBySection()].map(([section, lines]) =>
      toFile(`tst-diem-danh-${section}.csv`, lines),
    );
    expect(files).toHaveLength(3);
    ({ batchId } = await createImportBatch({ ...meta, files }, IMPORT_ACTOR, noEnqueue));
    await validateImportBatch(batchId);
    const staged = await batchOf(batchId);
    expect(staged).toMatchObject({
      status: ImportBatchStatus.STAGED,
      totalRows: 120,
      successRows: 120,
      errorRows: 0,
      fileName: files[0]?.fileName,
    });
    // Cảnh báo sai tên vẫn có, kèm tên file.
    expect(staged.warnings?.[0]).toMatchObject({ code: 'NAME_MISMATCH' });
    expect(staged.warnings?.[0]?.file).toMatch(/^tst-diem-danh-/);

    const detail = await getImportBatchDetail(batchId);
    expect(detail?.fileCount).toBe(3);
    expect(detail?.courses).toHaveLength(3);
    expect(detail?.files.map((f) => [f.totalRows, f.successRows, f.errorRows])).toEqual([
      [40, 40, 0],
      [40, 40, 0],
      [40, 40, 0],
    ]);
    for (const f of detail?.files ?? []) expect(f.courseIds).toHaveLength(1);
    expectPlain(detail?.files[0]);
  });

  it('xác nhận: nạp cả lô 1 lần; hoàn tác cả lô', async () => {
    const loaded = await confirmAndLoad(ds, batchId);
    expect(loaded).toMatchObject({ status: ImportBatchStatus.RECONCILED, successRows: 120 });
    expect(await ds.getRepository(AttendanceSummary).countBy({ importBatchId: batchId })).toBe(120);
    await rollbackImportBatch(batchId, IMPORT_ACTOR, noEnqueue);
    expect((await batchOf(batchId)).status).toBe(ImportBatchStatus.ROLLED_BACK);
    expect(await ds.getRepository(AttendanceSummary).countBy({ importBatchId: batchId })).toBe(0);
  });
});

describe('Dòng lỗi và trùng xuyên file', () => {
  it('trùng dòng của file trước → DUPLICATE ghi tên file; file lỗi tải về có cột ten_file', async () => {
    const [first] = [...attendanceBySection().values()];
    const lines = first ?? [];
    const copy = [
      lines[0] ?? '',
      lines[1] ?? '',
      'TSTK2411999,Không,Có,TST010240802,,Logic học,2025-10-02,30,0,0,0',
    ];
    const { batchId } = await createImportBatch(
      {
        ...meta,
        files: [toFile('tst-a.csv', lines), toFile('tst-b.csv', copy)],
      },
      IMPORT_ACTOR,
      noEnqueue,
    );
    await validateImportBatch(batchId);
    const errors = await listErrorRows(batchId, firstPage({ size: 50 }));
    expect(errors.items.map((e) => [e.sourceFileName, e.sourceRowNumber, e.errorReason])).toEqual([
      ['tst-b.csv', 2, 'DUPLICATE'],
      ['tst-b.csv', 3, 'STUDENT_NOT_FOUND'],
    ]);
    expect(errors.items[0]?.errorDetail).toBe('Trùng với dòng 2 của file tst-a.csv.');
    const csv = await buildErrorCsv(batchId);
    expect(csv.split('\r\n')[0]).toMatch(/^﻿dong,ly_do,ma_loi,ten_file,mssv,/);
    expect(csv).toContain(',tst-b.csv,');
    await discardImportBatch(batchId, IMPORT_ACTOR);
  });

  it('1 file thiếu cột → từ chối cả lô, lời nhắn có tên file', async () => {
    const [first] = [...attendanceBySection().values()];
    const { batchId } = await createImportBatch(
      {
        ...meta,
        files: [toFile('tst-ok.csv', first ?? []), toFile('tst-sai.csv', ['mssv,ten', 'X,Y'])],
      },
      IMPORT_ACTOR,
      noEnqueue,
    );
    await validateImportBatch(batchId);
    const batch = await batchOf(batchId);
    expect(batch.status).toBe(ImportBatchStatus.REJECTED);
    expect(batch.errorMessage).toMatch(/^tst-sai\.csv: File thiếu cột bắt buộc/);
  });
});

describe('Tải lên từng file (lô UPLOADING)', () => {
  it('chặn file trùng nội dung / trùng tên trong lô và file đã nằm trong lô khác', async () => {
    const [a, b] = [...attendanceBySection().values()];
    const { batchId } = await beginImportUpload(meta, toFile('tst-u1.csv', a ?? []), IMPORT_ACTOR);
    await expect(
      addImportFile(batchId, toFile('tst-u2.csv', a ?? []), IMPORT_ACTOR),
    ).rejects.toMatchObject({ code: 'DUPLICATE_FILE' });
    await expect(
      addImportFile(batchId, toFile('tst-u1.csv', b ?? []), IMPORT_ACTOR),
    ).rejects.toMatchObject({ code: 'DUPLICATE_FILE' });
    // Người khác không thêm được file vào lô của mình.
    await expect(
      addImportFile(batchId, toFile('tst-u3.csv', b ?? []), 'OTHER'),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    await addImportFile(batchId, toFile('tst-u3.csv', b ?? []), IMPORT_ACTOR);
    await finishImportUpload(batchId, IMPORT_ACTOR, noEnqueue);
    expect((await batchOf(batchId)).status).toBe(ImportBatchStatus.VALIDATING);
    expect(await ds.getRepository(ImportBatchFile).countBy({ importBatchId: batchId })).toBe(2);
    // File a đã nằm trong lô còn hiệu lực → lô mới bị từ chối ngay khi tải lên.
    await expect(
      createImportBatch(
        { ...meta, fileName: 'tst-lai.csv', data: toFile('', a ?? []).data },
        IMPORT_ACTOR,
        noEnqueue,
      ),
    ).rejects.toMatchObject({ code: 'DUPLICATE_FILE' });
    await validateImportBatch(batchId);
    await discardImportBatch(batchId, IMPORT_ACTOR);
  });

  it('tối đa 50 file / lô; lô tải lên dở quá 1 ngày tự hủy', async () => {
    const files = Array.from({ length: 51 }, (_, i) => toFile(`tst-${i}.csv`, ['mssv']));
    await expect(
      createImportBatch({ ...meta, files }, IMPORT_ACTOR, noEnqueue),
    ).rejects.toMatchObject({ code: 'TOO_MANY_FILES' });
    const [a] = [...attendanceBySection().values()];
    const { batchId } = await beginImportUpload(meta, toFile('tst-do.csv', a ?? []), IMPORT_ACTOR);
    await expireStagedBatches(new Date(Date.now() + 2 * 24 * 3600 * 1000));
    expect((await batchOf(batchId)).status).toBe(ImportBatchStatus.DISCARDED);
  });
});

describe('Lịch sử nạp lọc theo học phần / khoa; độ mới theo học phần', () => {
  it('lọc học phần nhận diện trong file và khoa của lớp sinh hoạt', async () => {
    const lines = [...attendanceBySection().values()][0] ?? [];
    const staged = await uploadAndValidate(ds, 'tst-loc.csv', lines.join('\n'), ATTENDANCE, HK1);
    const courseId = staged.summary?.courses?.[0]?.courseId ?? '';
    expect(courseId).toMatch(/^TST/);
    const byCourse = await listImportBatches({ courseId });
    expect(byCourse.items.map((b) => b.id)).toContain(staged.id);
    expect(byCourse.items.every((b) => b.dataType === ATTENDANCE)).toBe(true);
    const byDept = await listImportBatches({ departmentId: 'K.CNTT', dataType: ATTENDANCE });
    expect(byDept.items.map((b) => b.id)).toContain(staged.id);
    const otherDept = await listImportBatches({ departmentId: 'K.KTCK' });
    expect(otherDept.items.map((b) => b.id)).not.toContain(staged.id);
    expectPlain(byCourse.items[0]);

    await confirmAndLoad(ds, staged.id);
    const freshness = await getDataFreshness({ termId: HK1 });
    const row = freshness.courses.find((c) => c.courseId === courseId);
    expect(row?.sources.ATTENDANCE.latest).not.toBeNull();
    expect(row?.sources.LMS_QUIZ).toEqual({ latest: null, stale: false });
    expect(row?.needsAttention).toBe(false);
  });
});
