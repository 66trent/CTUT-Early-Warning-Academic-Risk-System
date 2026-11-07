import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Alert } from '@/db/entities/alert.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { MoodleCourseLink } from '@/db/entities/moodle-course-link.entity';
import { MoodleSyncRun } from '@/db/entities/moodle-sync-run.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import { ImportBatchStatus, ImportSource, Severity, UserAccountStatus, UserRole } from '@/db/enums';
import {
  createImportBatch,
  getRollbackEligibility,
} from '@/modules/data-import/services/import-batch.service';
import {
  loadImportBatch,
  validateImportBatch,
} from '@/modules/data-import/services/import-processor.service';
import {
  listMoodleCourseRows,
  setMoodleLink,
} from '@/modules/data-import/services/moodle-link.service';
import {
  confirmMoodleSync,
  listMoodleSyncRuns,
  requestMoodleSync,
  runMoodleSync,
} from '@/modules/data-import/services/moodle-sync.service';
import { cleanupDemo, endOf, evaluate, vn } from '../helpers/demo-setup';
import {
  confirmAndLoad,
  IMPORT_ACTOR,
  noEnqueue,
  useMemoryStorage,
} from '../helpers/import-helpers';
import { createFixtureMoodleClient, fixtureCutoff } from '../helpers/moodle-fixtures';

/**
 * Nghiệm thu đồng bộ Moodle — docs/demo-data/moodle/KET_QUA_MONG_DOI.md. Máy chủ Moodle giả đọc
 * fixture (ngày chốt 06/11/2026); mã thật đổi sang mã thử: lớp KTPM2411 → TSTL2411, lớp học phần
 * 010100089201 → TST010089201 (liên kết ghi mã thử, học phần tự suy TST0100892).
 */
let ds: DataSource;
const TERM = 'TSTHK1_26';
const CLS = 'TSTL2411';
const ADVISOR = 'TSTGVL';
const MMT = { moodleId: 14, section: 'TST010089201', course: 'TST0100892', name: 'Mạng máy tính' };
const HDH = { moodleId: 15, section: 'TST010089101', course: 'TST0100891', name: 'Hệ điều hành' };
const sv = (n: number) => `${CLS}${n}`;
const { LOW, MEDIUM, HIGH, CRITICAL } = Severity;

const toTest = (json: string) =>
  json.replaceAll('KTPM2411', CLS).replaceAll('ktpm2411', CLS.toLowerCase());
/** 1 người dùng Moodle KHÔNG có trong EWARS ở cả 2 khóa → bỏ qua, đếm riêng. */
const OUTSIDER = {
  id: 99999,
  idnumber: 'NGOAI2411001',
  email: 'ngoai@student.ctuet.edu.vn',
  roles: [{ shortname: 'student' }],
};
const client = createFixtureMoodleClient({
  transform: toTest,
  patch: (fn, _params, response) =>
    fn === 'core_enrol_get_enrolled_users' ? [...(response as unknown[]), OUTSIDER] : response,
});
const syncAt = endOf(fixtureCutoff());

async function sync(): Promise<MoodleSyncRun> {
  const { runId } = await requestMoodleSync(TERM, IMPORT_ACTOR, noEnqueue);
  return runMoodleSync(runId, {
    client,
    enqueueImport: noEnqueue,
    now: syncAt,
    fileNamePrefix: 'tst-',
  });
}

async function cleanup(): Promise<void> {
  await cleanupDemo(ds);
  await ds.query(`DELETE FROM users WHERE user_id = $1`, [ADVISOR]);
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await cleanup();
  await ds.getRepository(User).insert({
    userId: ADVISOR,
    fullName: 'Cố vấn thử Moodle',
    email: 'tstgvl@ctuet.edu.vn',
    role: UserRole.ADVISOR,
    accountStatus: UserAccountStatus.ACTIVE,
    authUserId: null,
  });
  await ds.getRepository(AdministrativeClass).insert({
    classId: CLS,
    className: 'Lớp thử Moodle',
    departmentId: 'K.CNTT',
    majorId: 'KTPM',
    cohortYear: '2024',
    advisorId: ADVISOR,
  });
  // Bắt đầu 16/08 (sớm hơn HK1_2026 thật 1 ngày) — tránh hòa "học kỳ liền trước" (bẫy #32).
  await ds.getRepository(Term).insert({
    termId: TERM,
    termName: 'Học kỳ thử Moodle',
    academicYear: '2026-2027',
    startDate: vn('2026-08-16'),
    endDate: vn('2026-12-27', '23:59:59'),
    isCurrent: false,
  });
  const header = 'mssv,ho_ten,email,ma_lop_sinh_hoat,trang_thai_hoc_vu';
  const lines = readFileSync('docs/demo-data/01_sinh_vien.csv', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes(',KTPM2411,'));
  const { batchId } = await createImportBatch(
    {
      dataType: 'STUDENT',
      termId: null,
      parentBatchId: null,
      fileName: 'tst-moodle-sinh-vien.csv',
      data: Buffer.from(toTest([header, ...lines].join('\n')), 'utf8'),
    },
    IMPORT_ACTOR,
    noEnqueue,
  );
  await validateImportBatch(batchId);
  expect((await confirmAndLoad(ds, batchId)).successRows).toBe(20);
  // Admin bật 2 khóa (qua service — lấy tên/Course ID number từ Moodle), rồi đổi sang mã thử.
  for (const c of [MMT, HDH]) {
    await setMoodleLink(
      { termId: TERM, moodleCourseId: c.moodleId, enabled: true },
      IMPORT_ACTOR,
      client,
    );
    await ds
      .getRepository(MoodleCourseLink)
      .update(
        { termId: TERM, moodleCourseId: c.moodleId },
        { sectionCode: c.section, courseId: c.course },
      );
  }
}, 180_000);

afterAll(async () => {
  await cleanup();
  await closeDataSource();
});

describe('Đồng bộ Moodle — docs/demo-data/moodle/KET_QUA_MONG_DOI.md', () => {
  it('trang Kết nối: 2 khóa có Course ID number 12 số, đã bật, tên học phần lấy từ tên khóa Moodle', async () => {
    const rows = await listMoodleCourseRows(TERM, client);
    expect(
      rows.map((r) => [r.moodleCourseId, r.linkable, r.link?.enabled, r.link?.courseName]),
    ).toEqual([
      [HDH.moodleId, true, true, HDH.name],
      [MMT.moodleId, true, true, MMT.name],
    ]);
  });

  let runId = '';
  it('đồng bộ → 3 lô STAGED nguồn MOODLE, mỗi lô 2 file, đúng 480 · 121 · 120 dòng, 0 lỗi', async () => {
    const run = await sync();
    runId = run.id;
    expect(run.status).toBe('STAGED');
    const types = ['ATTENDANCE_SUMMARY', 'LMS_QUIZ', 'LMS_ASSIGNMENT'] as const;
    const expected = { ATTENDANCE_SUMMARY: 480, LMS_QUIZ: 121, LMS_ASSIGNMENT: 120 };
    for (const type of types) {
      const batchId = run.batchIds[type] ?? '';
      await validateImportBatch(batchId);
      const batch = await ds.getRepository(ImportBatch).findOneByOrFail({ id: batchId });
      expect(batch.source).toBe(ImportSource.MOODLE);
      expect(batch.status, `${type}: ${batch.errorMessage ?? ''}`).toBe(ImportBatchStatus.STAGED);
      expect([type, batch.successRows, batch.errorRows]).toEqual([type, expected[type], 0]);
    }
    // Sinh viên Moodle chưa có trong EWARS: bỏ qua, đếm riêng ở từng khóa (không thành dòng lỗi).
    expect(run.stats?.courses.map((c) => [c.sectionCode, c.unknownStudents, c.error])).toEqual([
      [HDH.section, 1, null],
      [MMT.section, 1, null],
    ]);
    const link = await ds
      .getRepository(MoodleCourseLink)
      .findOneByOrFail({ termId: TERM, moodleCourseId: MMT.moodleId });
    expect(link.unknownStudents).toEqual([
      { moodleUserId: OUTSIDER.id, idnumber: OUTSIDER.idnumber, email: OUTSIDER.email },
    ]);
    const [dto] = await listMoodleSyncRuns(TERM);
    expect(dto).toMatchObject({ id: runId, canConfirm: true, canDiscard: true });
    expect(dto?.batches.map((b) => b.fileCount)).toEqual([2, 2, 2]);
    expect(Object.getPrototypeOf(dto)).toBe(Object.prototype);
  });

  it('Xác nhận nạp cả 3 → chạy đánh giá mốc 06/11: đúng và đủ 12 dấu hiệu, 9 cảnh báo', async () => {
    expect(await confirmMoodleSync(runId, IMPORT_ACTOR, noEnqueue)).toEqual({ confirmed: 3 });
    const run = await ds.getRepository(MoodleSyncRun).findOneByOrFail({ id: runId });
    for (const batchId of Object.values(run.batchIds)) {
      await loadImportBatch(batchId, { retried: false, afterReconciled: noEnqueue });
    }
    const evaluationId = await evaluate(TERM, syncAt);
    const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: evaluationId });
    const keys = triggers
      .map((t) => `${t.studentId}|${t.scopeId}|${t.ruleCode}|${t.severity}`)
      .sort();
    const row = (n: number, course: string, rule: string, severity: Severity) =>
      `${sv(n)}|${course}|${rule}|${severity}`;
    expect(keys).toEqual(
      [
        row(903, MMT.course, 'ATT-01', CRITICAL),
        row(904, HDH.course, 'ATT-01', MEDIUM),
        row(904, HDH.course, 'ATT-02', HIGH),
        row(905, HDH.course, 'LMS-01', HIGH),
        row(906, MMT.course, 'ATT-01', MEDIUM),
        row(907, MMT.course, 'LMS-03', HIGH),
        row(909, MMT.course, 'LMS-04', LOW),
        row(911, HDH.course, 'LMS-02', MEDIUM),
        row(913, HDH.course, 'ATT-01', MEDIUM),
        row(913, HDH.course, 'LMS-03', MEDIUM),
        row(913, HDH.course, 'COMB-01', CRITICAL),
        row(917, MMT.course, 'LMS-01', MEDIUM),
      ].sort(),
    );
    const alerts = await ds.getRepository(Alert).findBy({ termId: TERM });
    expect(alerts.map((a) => `${a.studentId}|${a.severity}`).sort()).toEqual(
      [
        [903, CRITICAL],
        [904, HIGH],
        [905, HIGH],
        [906, MEDIUM],
        [907, HIGH],
        [909, LOW],
        [911, MEDIUM],
        [913, CRITICAL],
        [917, MEDIUM],
      ]
        .map(([n, s]) => `${sv(n as number)}|${s as string}`)
        .sort(),
    );
    expect(alerts.every((a) => a.isReferenceOnly)).toBe(true);
  });

  it('lô Moodle không hoàn tác được (Moodle là nguồn gốc)', async () => {
    const run = await ds.getRepository(MoodleSyncRun).findOneByOrFail({ id: runId });
    const batch = await ds
      .getRepository(ImportBatch)
      .findOneByOrFail({ id: run.batchIds.LMS_QUIZ ?? '' });
    expect(await getRollbackEligibility(batch)).toMatchObject({ allowed: false });
  });

  it('đồng bộ lại khi Moodle không đổi → "Không có thay đổi", không tạo lô mới', async () => {
    const before = await ds.getRepository(ImportBatch).countBy({ termId: TERM });
    const run = await sync();
    expect(run.status).toBe('NO_CHANGE');
    expect(run.batchIds).toEqual({});
    expect(run.stats?.unchangedFiles).toEqual({
      ATTENDANCE_SUMMARY: 2,
      LMS_QUIZ: 2,
      LMS_ASSIGNMENT: 2,
    });
    expect(await ds.getRepository(ImportBatch).countBy({ termId: TERM })).toBe(before);
  });
});
