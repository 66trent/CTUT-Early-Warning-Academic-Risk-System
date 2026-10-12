import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { Course } from '@/db/entities/course.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import {
  AttemptOutcome,
  CourseResultStatus,
  EnrollmentStatus,
  ImportBatchStatus,
  OfficialAcademicStatus,
  QuizAttemptStatus,
} from '@/db/enums';
import { buildErrorCsv } from '@/modules/data-import/services/error-file.service';
import {
  getRollbackEligibility,
  rollbackImportBatch,
} from '@/modules/data-import/services/import-batch.service';
import { cleanupIdentityFixtures } from '../helpers/identity-fixtures';
import {
  cleanupImportBatches,
  confirmAndLoad,
  demoAcademicCsv,
  demoStudentsCsv,
  IMPORT_ACTOR,
  TEST_CLASSES,
  uploadAndValidate,
  useMemoryStorage,
} from '../helpers/import-helpers';

/** DoD Phase 3b — nạp 4 file nguồn học tập của docs/demo-data (bản sao mã TST) vào Postgres thật. */
let ds: DataSource;
const HK2 = 'TSTHK2_25';
const HK1 = 'TSTHK1_26';
const vn = (date: string) => new Date(`${date}T00:00:00+07:00`);
const vnEnd = (date: string) => new Date(`${date}T23:59:59+07:00`);

const FILES = {
  hk2Results: '02_HK2_2025_ket_qua_hoc_phan.csv',
  attendance: '03_HK1_2026_diem_danh_tong_hop.csv',
  lms: '04_HK1_2026_lms_bai_kiem_tra.csv',
  midterm: '05_HK1_2026_ket_qua_giua_ky.csv',
} as const;

async function cleanup() {
  await cleanupImportBatches(ds);
  await ds.query(`DELETE FROM enrollments WHERE student_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM courses WHERE course_id LIKE 'TST%'`);
  await cleanupIdentityFixtures(ds);
  await ds.query(`DELETE FROM administrative_classes WHERE class_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM terms WHERE term_id LIKE 'TST%'`);
}

/** Nạp 1 file demo (2 bước), khẳng định 0 lỗi, 0 cảnh báo. */
async function loadDemo(file: string, termId: string, expectedRows: number) {
  const staged = await uploadAndValidate(
    ds,
    `tst-${file}`,
    demoAcademicCsv(file),
    typeOf(file),
    termId,
  );
  expect(staged).toMatchObject({
    status: ImportBatchStatus.STAGED,
    totalRows: expectedRows,
    errorRows: 0,
  });
  const loaded = await confirmAndLoad(ds, staged.id);
  expect(loaded).toMatchObject({
    status: ImportBatchStatus.RECONCILED,
    successRows: expectedRows,
    errorRows: 0,
    warnings: null,
  });
  return loaded;
}

function typeOf(file: string): string {
  if (file.includes('diem_danh')) return 'ATTENDANCE_SUMMARY';
  if (file.includes('lms')) return 'LMS_QUIZ';
  return 'COURSE_RESULT';
}

const countFor = async (entity: typeof AttendanceSummary | typeof LmsQuizAttempt, termId: string) =>
  ds
    .getRepository(entity)
    .createQueryBuilder('x')
    .innerJoin(Enrollment, 'e', 'e.enrollmentId = x.enrollmentId')
    .where('e.termId = :termId', { termId })
    .getCount();

async function enrollmentOf(studentId: string, courseId: string, termId: string) {
  return ds.getRepository(Enrollment).findOneByOrFail({ studentId, courseId, termId });
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await cleanup();
  await ds.getRepository(AdministrativeClass).insert(
    TEST_CLASSES.map((classId) => ({
      classId,
      className: `Lớp thử ${classId}`,
      departmentId: 'K.CNTT',
      cohortYear: '2023',
      advisorId: null,
    })),
  );
  await ds.getRepository(Term).insert([
    {
      termId: HK2,
      termName: 'Học kỳ thử 2, 2025–2026',
      academicYear: '2025-2026',
      startDate: vn('2026-01-05'),
      endDate: vnEnd('2026-05-31'),
      isCurrent: false,
    },
    {
      termId: HK1,
      termName: 'Học kỳ thử 1, 2026–2027',
      academicYear: '2026-2027',
      startDate: vn('2026-08-17'),
      endDate: vnEnd('2026-12-27'),
      isCurrent: false,
    },
  ]);
  const students = await uploadAndValidate(ds, 'tst-01_sinh_vien.csv', demoStudentsCsv());
  await confirmAndLoad(ds, students.id);
});

afterAll(async () => {
  await cleanup();
  await closeDataSource();
});

describe('Nạp 4 file nguồn demo theo đúng thứ tự — 0 lỗi, 0 cảnh báo', () => {
  it('02 kết quả HK2: 29 kết quả FINAL, Course có tín chỉ, outcome đúng', async () => {
    await loadDemo(FILES.hk2Results, HK2, 29);
    const results = await ds
      .getRepository(CourseResult)
      .find({ relations: { enrollment: true }, where: { enrollment: { termId: HK2 } } });
    expect(results).toHaveLength(29);
    expect(results.every((r) => r.resultStatus === CourseResultStatus.FINAL)).toBe(true);
    const failed = await enrollmentOf('TSTK2311009', 'TSTC103', HK2);
    expect(failed).toMatchObject({
      attemptOutcome: AttemptOutcome.FAILED,
      enrollmentStatus: EnrollmentStatus.COMPLETED,
      attemptNumber: 1,
    });
    expect(await ds.getRepository(Course).findOneByOrFail({ courseId: 'TSTC103' })).toMatchObject({
      courseName: 'Mạng máy tính',
      credits: 3,
    });
  });

  it('03 điểm danh HK1: 17 bản ghi; học lại KTPM103 → attemptNumber = 2', async () => {
    await loadDemo(FILES.attendance, HK1, 17);
    expect(await countFor(AttendanceSummary, HK1)).toBe(17);
    expect(await enrollmentOf('TSTK2311009', 'TSTC103', HK1)).toMatchObject({
      attemptNumber: 2,
      attemptOutcome: AttemptOutcome.PENDING,
      enrollmentStatus: EnrollmentStatus.REGISTERED,
    });
    const snapshots = await ds.getRepository(AttendanceSummary).find({
      where: { enrollmentId: (await enrollmentOf('TSTK2311003', 'TSTC201', HK1)).enrollmentId },
      order: { snapshotDate: 'ASC' },
    });
    expect(snapshots.map((s) => [s.snapshotDate.toISOString(), s.unexcusedAbsence])).toEqual([
      [vn('2026-10-02').toISOString(), 1],
      [vn('2026-10-09').toISOString(), 6],
    ]);
  });

  it('04 LMS HK1: 32 lượt làm bài, chỉ lưu lượt có thật', async () => {
    await loadDemo(FILES.lms, HK1, 32);
    expect(await countFor(LmsQuizAttempt, HK1)).toBe(32);
    const inProgress = await ds
      .getRepository(LmsQuizAttempt)
      .findOneByOrFail({ status: QuizAttemptStatus.IN_PROGRESS, quizKey: 'Q03' });
    expect(inProgress).toMatchObject({ submittedAt: null, score: null, maxScore: 10 });
  });

  it('05 điểm giữa kỳ HK1: 10 kết quả PROCESS_ONLY, chưa đổi outcome', async () => {
    await loadDemo(FILES.midterm, HK1, 10);
    const enrollment = await enrollmentOf('TSTK2311007', 'TSTC201', HK1);
    expect(
      await ds
        .getRepository(CourseResult)
        .findOneByOrFail({ enrollmentId: enrollment.enrollmentId }),
    ).toMatchObject({
      resultStatus: CourseResultStatus.PROCESS_ONLY,
      processScore: 4,
      passed: null,
      publishedAt: vn('2026-10-05'),
    });
    expect(enrollment.attemptOutcome).toBe(AttemptOutcome.PENDING);
  });

  it('không ghi trạng thái học vụ chính thức của sinh viên', async () => {
    const statuses = await ds
      .getRepository(Student)
      .find({ select: { officialAcademicStatus: true }, where: { classId: 'TSTK2311' } });
    expect(statuses.every((s) => s.officialAcademicStatus === OfficialAcademicStatus.ACTIVE)).toBe(
      true,
    );
  });

  it('nạp lại đúng file đó → bị chặn', async () => {
    await expect(
      uploadAndValidate(ds, `tst-${FILES.lms}`, demoAcademicCsv(FILES.lms), 'LMS_QUIZ', HK1),
    ).rejects.toMatchObject({ code: 'DUPLICATE_FILE' });
  });
});

describe('Nạp lại là cập nhật, không nhân đôi', () => {
  it('điểm danh cùng ngày chốt với số liệu mới → cập nhật 1, không đổi 16', async () => {
    const csv = demoAcademicCsv(FILES.attendance).replace(
      'TSTK2311004,TSTC201,Công nghệ phần mềm,2026-10-09,16,13,3,0,0',
      'TSTK2311004,TSTC201,Công nghệ phần mềm,2026-10-09,16,12,4,0,0',
    );
    const staged = await uploadAndValidate(
      ds,
      'tst-diem-danh-sua.csv',
      csv,
      'ATTENDANCE_SUMMARY',
      HK1,
    );
    const loaded = await confirmAndLoad(ds, staged.id);
    expect(loaded.summary).toMatchObject({ inserted: 0, updated: 1, unchanged: 16 });
    expect(await countFor(AttendanceSummary, HK1)).toBe(17);
    expect((await getRollbackEligibility(loaded)).allowed).toBe(false);
  });

  it('LMS cùng lượt: đang làm → đã nộp được cập nhật', async () => {
    const csv = demoAcademicCsv(FILES.lms).replace(
      'TSTK2311005,TSTC201,Q03,Kiểm tra chương 3,1,2026-09-29 21:00,,,,10,IN_PROGRESS',
      'TSTK2311005,TSTC201,Q03,Kiểm tra chương 3,1,2026-09-29 21:00,2026-09-29 21:30,30,6,10,Đã nộp',
    );
    const staged = await uploadAndValidate(ds, 'tst-lms-sua.csv', csv, 'LMS_QUIZ', HK1);
    const loaded = await confirmAndLoad(ds, staged.id);
    expect(loaded.summary).toMatchObject({ inserted: 0, updated: 1, unchanged: 31 });
    expect(await countFor(LmsQuizAttempt, HK1)).toBe(32);
    const enrollment = await enrollmentOf('TSTK2311005', 'TSTC201', HK1);
    expect(
      await ds.getRepository(LmsQuizAttempt).findOneByOrFail({
        enrollmentId: enrollment.enrollmentId,
        quizKey: 'Q03',
      }),
    ).toMatchObject({ status: QuizAttemptStatus.SUBMITTED, score: 6 });
  });
});

describe('Dòng lỗi có lý do dễ hiểu', () => {
  const header =
    'mssv,ma_hoc_phan,ten_hoc_phan,ngay_chot,tong_buoi,co_mat,di_tre,vang_co_phep,vang_khong_phep';

  it('mssv lạ → STUDENT_NOT_FOUND; ngày ngoài học kỳ → TERM_MISMATCH; ngày kiểu Mỹ → INVALID_FORMAT', async () => {
    const csv = [
      header,
      'TSTK2311001,TSTC201,Công nghệ phần mềm,2026-10-16,18,18,0,0,0',
      'TSTK2399999,TSTC201,Công nghệ phần mềm,2026-10-16,18,18,0,0,0',
      'TSTK2311001,TSTC201,Công nghệ phần mềm,2027-01-15,18,18,0,0,0',
      'TSTK2311002,TSTC201,Công nghệ phần mềm,10/16/2026,18,18,0,0,0',
    ].join('\n');
    const batch = await uploadAndValidate(
      ds,
      'tst-diem-danh-loi.csv',
      csv,
      'ATTENDANCE_SUMMARY',
      HK1,
    );
    expect(batch).toMatchObject({ status: ImportBatchStatus.STAGED, successRows: 1, errorRows: 3 });
    const errors = await ds
      .getRepository(ImportErrorRow)
      .find({ where: { importBatchId: batch.id }, order: { sourceRowNumber: 'ASC' } });
    expect(errors.map((e) => [e.sourceRowNumber, e.errorReason])).toEqual([
      [3, 'STUDENT_NOT_FOUND'],
      [4, 'TERM_MISMATCH'],
      [5, 'INVALID_FORMAT'],
    ]);
    const file = await buildErrorCsv(batch.id);
    expect(file).toContain('Sinh viên TSTK2399999 chưa có trong danh sách');
    expect(file).toContain('YYYY-MM-DD');
  });

  it('cột học kỳ khác học kỳ đã chọn → TERM_MISMATCH', async () => {
    const csv = [
      `${header},hoc_ky`,
      `TSTK2311001,TSTC201,Công nghệ phần mềm,2026-10-16,18,18,0,0,0,${HK2}`,
      `TSTK2311002,TSTC201,Công nghệ phần mềm,2026-10-16,18,18,0,0,0,${HK1}`,
    ].join('\n');
    const batch = await uploadAndValidate(
      ds,
      'tst-diem-danh-hk.csv',
      csv,
      'ATTENDANCE_SUMMARY',
      HK1,
    );
    expect(batch).toMatchObject({ successRows: 1, errorRows: 1 });
    expect(
      await ds.getRepository(ImportErrorRow).findOneByOrFail({ importBatchId: batch.id }),
    ).toMatchObject({ sourceRowNumber: 2, errorReason: 'TERM_MISMATCH' });
  });

  it('điểm giữa kỳ cho kết quả đã FINAL → RESULT_ALREADY_FINAL', async () => {
    const csv = [
      'mssv,ma_hoc_phan,ten_hoc_phan,so_tin_chi,diem_qua_trinh,diem_thi,diem_tong_ket,diem_chu,ket_qua',
      'TSTK2311009,TSTC103,Mạng máy tính,3,6,,,,',
      'TSTK2311010,TSTC101,Cơ sở dữ liệu,3,4,3,3.4,F,KHONG_DAT',
    ].join('\n');
    const batch = await uploadAndValidate(ds, 'tst-ket-qua-final.csv', csv, 'COURSE_RESULT', HK2);
    expect(batch).toMatchObject({ successRows: 1, errorRows: 1 });
    expect(
      await ds.getRepository(ImportErrorRow).findOneByOrFail({ importBatchId: batch.id }),
    ).toMatchObject({ sourceRowNumber: 2, errorReason: 'RESULT_ALREADY_FINAL' });
  });

  it('điểm chữ lệch điểm tổng kết → nạp theo điểm chữ, ghi cảnh báo của lô', async () => {
    const csv = [
      'mssv,ma_hoc_phan,ten_hoc_phan,so_tin_chi,diem_qua_trinh,diem_thi,diem_tong_ket,diem_chu,ket_qua',
      'TSTK2311013,TSTC104,Học phần thử,2,8,8,8.0,A,DAT',
    ].join('\n');
    const batch = await uploadAndValidate(ds, 'tst-ket-qua-lech.csv', csv, 'COURSE_RESULT', HK2);
    expect(batch.warnings).toEqual([
      expect.objectContaining({ row: 2, code: 'LETTER_GRADE_MISMATCH' }),
    ]);
  });
});

describe('Lần học không phụ thuộc thứ tự nạp file', () => {
  it('hoàn tác file HK2 → xóa kết quả + Enrollment lô tạo, KTPM103 HK1 về lần 1', async () => {
    const hk2 = await ds.getRepository(Enrollment).findOneByOrFail({
      studentId: 'TSTK2311009',
      courseId: 'TSTC103',
      termId: HK2,
    });
    await rollbackImportBatch(hk2.firstSeenBatchId, IMPORT_ACTOR);
    expect(await ds.getRepository(Enrollment).countBy({ termId: HK2 })).toBe(0);
    expect(await enrollmentOf('TSTK2311009', 'TSTC103', HK1)).toMatchObject({ attemptNumber: 1 });
  });

  it('nạp file HK2 SAU file HK1 → tính lại attemptNumber = 2', async () => {
    await loadDemo(FILES.hk2Results, HK2, 29);
    expect(await enrollmentOf('TSTK2311009', 'TSTC103', HK1)).toMatchObject({ attemptNumber: 2 });
    expect(await enrollmentOf('TSTK2311010', 'TSTC103', HK2)).toMatchObject({
      attemptOutcome: AttemptOutcome.PASSED,
    });
  });

  it('sinh viên đã có dữ liệu học tập → không hoàn tác được lô danh sách sinh viên', async () => {
    const student = await ds.query<{ id: string }[]>(
      `SELECT id FROM import_batches WHERE file_name = 'tst-01_sinh_vien.csv' AND data_type = 'STUDENT'`,
    );
    await expect(rollbackImportBatch(student[0]?.id ?? '', IMPORT_ACTOR)).rejects.toMatchObject({
      code: 'ROLLBACK_NOT_ALLOWED',
    });
  });
});
