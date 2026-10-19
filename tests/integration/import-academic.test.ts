import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { Course } from '@/db/entities/course.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { LmsActivity } from '@/db/entities/lms-activity.entity';
import { LmsAssignmentSubmission } from '@/db/entities/lms-assignment-submission.entity';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import {
  AttemptOutcome,
  EnrollmentStatus,
  ImportBatchStatus,
  LmsActivityType,
  OfficialAcademicStatus,
  SubmissionStatus,
} from '@/db/enums';
import { buildErrorCsv } from '@/modules/data-import/services/error-file.service';
import {
  createImportBatch,
  getRollbackEligibility,
  rollbackImportBatch,
} from '@/modules/data-import/services/import-batch.service';
import { validateImportBatch } from '@/modules/data-import/services/import-processor.service';
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

/** Nạp 5 file nguồn học tập của bộ demo v2 (bản sao mã TST) vào Postgres thật. */
let ds: DataSource;
const HK1: string = DEMO.hk1;
const PREV = 'TSTHK3_24';
const LOG = 'TST0102408';
const NNLT = 'TST0102394';
const CSDL = 'TST0102410';
const sv = (n: number) => `TSTK2411${n}`;

const FILES = {
  attendance: '02_HK1_2025_diem_danh.csv',
  quiz: '03_HK1_2025_lms_trac_nghiem.csv',
  assignment: '04_HK1_2025_lms_thuc_hanh.csv',
  logResults: '05_HK1_2025_ket_qua_logic_hoc.csv',
  finalResults: '06_HK1_2025_ket_qua_cuoi_ky.csv',
} as const;

const TYPE: Record<string, string> = {
  [FILES.attendance]: 'ATTENDANCE_SUMMARY',
  [FILES.quiz]: 'LMS_QUIZ',
  [FILES.assignment]: 'LMS_ASSIGNMENT',
  [FILES.logResults]: 'COURSE_RESULT',
  [FILES.finalResults]: 'COURSE_RESULT',
};

/** Nạp 1 file demo (2 bước), khẳng định số dòng, 0 lỗi và số cảnh báo. */
async function loadDemo(file: string, expectedRows: number, warnings = 0) {
  const staged = await uploadAndValidate(ds, `tst-${file}`, demoAcademicCsv(file), TYPE[file], HK1);
  expect(staged).toMatchObject({
    status: ImportBatchStatus.STAGED,
    totalRows: expectedRows,
    errorRows: 0,
  });
  expect(staged.warnings ?? [], file).toHaveLength(warnings);
  const loaded = await confirmAndLoad(ds, staged.id);
  expect(loaded).toMatchObject({
    status: ImportBatchStatus.RECONCILED,
    successRows: expectedRows,
    errorRows: 0,
  });
  return { staged, loaded };
}

async function load(name: string, lines: string[], dataType: string, termId = HK1) {
  const staged = await uploadAndValidate(ds, `tst-${name}`, lines.join('\n'), dataType, termId);
  return { staged, loaded: await confirmAndLoad(ds, staged.id) };
}

const countIn = async (
  entity: typeof AttendanceSummary | typeof LmsQuizAttempt | typeof LmsAssignmentSubmission,
) =>
  ds
    .getRepository(entity)
    .createQueryBuilder('x')
    .innerJoin(Enrollment, 'e', 'e.enrollmentId = x.enrollmentId')
    .where('e.termId = :termId', { termId: HK1 })
    .getCount();

async function enrollmentOf(n: number, courseId: string, termId = HK1) {
  return ds.getRepository(Enrollment).findOneByOrFail({ studentId: sv(n), courseId, termId });
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
  const term = (termId: string, start: string, end: string) => ({
    termId,
    termName: `Học kỳ thử ${termId}`,
    academicYear: '2025-2026',
    startDate: vn(start),
    endDate: vn(end, '23:59:59'),
    isCurrent: false,
  });
  await ds
    .getRepository(Term)
    .insert([term(PREV, '2025-05-04', '2025-08-10'), term(HK1, '2025-08-18', '2025-12-28')]);
  const students = await uploadAndValidate(ds, 'tst-01_sinh_vien.csv', demoStudentsCsv());
  await confirmAndLoad(ds, students.id);
});

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Nạp 5 file demo theo đúng thứ tự — mã học phần tự suy, thẻ nhận diện', () => {
  it('02 điểm danh: 120 dòng, 1 cảnh báo sai tên; thẻ nhận diện 3 học phần ở màn xem trước', async () => {
    const { staged } = await loadDemo(FILES.attendance, 120, 1);
    expect(staged.warnings?.[0]).toMatchObject({ code: 'NAME_MISMATCH' });
    expect(staged.warnings?.[0]?.message).toContain('Đặng Minh Tuấn');
    const cards = staged.summary?.courses ?? [];
    expect(cards.map((c) => c.courseName)).toEqual([
      'Cơ sở dữ liệu',
      'Logic học',
      'Ngôn ngữ lập trình 1',
    ]);
    expect(cards.find((c) => c.courseId === LOG)).toEqual({
      courseId: LOG,
      courseName: 'Logic học',
      derivedCode: true,
      isNew: true,
      sectionCodes: ['TST010240802'],
      validRows: 40,
      errorRows: 0,
      warningRows: 0,
      studentCount: 20,
      classes: [{ classId: 'TSTK2411', departmentId: 'K.CNTT', count: 20 }],
      totalPeriods: 30,
      snapshotDates: ['2025-10-02', '2025-10-09'],
      previousSnapshotDate: null,
    });
    expect(cards.find((c) => c.courseId === CSDL)?.warningRows).toBe(1);
    expect(await countIn(AttendanceSummary)).toBe(120);
    expect(await enrollmentOf(903, NNLT)).toMatchObject({
      sectionCode: 'TST010239401',
      attemptNumber: 1,
      enrollmentStatus: EnrollmentStatus.REGISTERED,
    });
    const snapshots = await ds.getRepository(AttendanceSummary).find({
      where: { enrollmentId: (await enrollmentOf(903, NNLT)).enrollmentId },
      order: { snapshotDate: 'ASC' },
    });
    expect(snapshots.map((s) => [s.totalPeriods, s.excusedAbsence, s.unexcusedAbsence])).toEqual([
      [45, 2, 2],
      [45, 2, 8],
    ]);
  });

  it('03 trắc nghiệm: 81 dòng → 4 bài, 79 lượt làm (dòng "Chưa làm" không tạo lượt)', async () => {
    await loadDemo(FILES.quiz, 81);
    expect(await countIn(LmsQuizAttempt)).toBe(79);
    const quizzes = await ds
      .getRepository(LmsActivity)
      .findBy({ termId: HK1, activityType: LmsActivityType.QUIZ });
    expect(quizzes).toHaveLength(4);
    const tn01 = quizzes.find((q) => q.courseId === LOG && q.activityKey === 'TN01');
    expect(tn01).toMatchObject({
      sectionCode: 'TST010240802',
      dueAt: vn('2025-09-20', '23:59:00'),
    });
    expect(
      await ds
        .getRepository(LmsQuizAttempt)
        .countBy({ enrollmentId: (await enrollmentOf(905, LOG)).enrollmentId }),
    ).toBe(0);
  });

  it('04 thực hành: 100 dòng → 5 bài, 100 trạng thái nộp, không lưu điểm', async () => {
    await loadDemo(FILES.assignment, 100);
    expect(await countIn(LmsAssignmentSubmission)).toBe(100);
    expect(
      await ds
        .getRepository(LmsActivity)
        .countBy({ termId: HK1, activityType: LmsActivityType.ASSIGNMENT }),
    ).toBe(5);
    const th01 = await ds
      .getRepository(LmsActivity)
      .findOneByOrFail({ courseId: NNLT, activityKey: 'TH01' });
    expect(
      await ds.getRepository(LmsAssignmentSubmission).findOneByOrFail({
        enrollmentId: (await enrollmentOf(908, NNLT)).enrollmentId,
        activityId: th01.id,
      }),
    ).toMatchObject({ status: SubmissionStatus.NOT_SUBMITTED, submittedAt: null });
  });

  it('05 kết quả Logic học: 20 dòng; tín chỉ, không đạt, cấm thi, vắng thi', async () => {
    await loadDemo(FILES.logResults, 20);
    expect(await ds.getRepository(Course).findOneByOrFail({ courseId: LOG })).toMatchObject({
      courseName: 'Logic học',
      credits: 2,
    });
    const e913 = await enrollmentOf(913, LOG);
    expect(e913).toMatchObject({
      attemptOutcome: AttemptOutcome.FAILED,
      enrollmentStatus: EnrollmentStatus.COMPLETED,
    });
    expect(
      await ds.getRepository(CourseResult).findOneByOrFail({ enrollmentId: e913.enrollmentId }),
    ).toMatchObject({ letterGrade: 'F', passed: false, eligibleForExam: false, examScore: null });
    expect(
      await ds
        .getRepository(CourseResult)
        .findOneByOrFail({ enrollmentId: (await enrollmentOf(914, LOG)).enrollmentId }),
    ).toMatchObject({ absentFromExam: true, publishedAt: vn('2025-11-16') });
  });

  it('06 kết quả cuối kỳ: 39 dòng; sinh viên thiếu kết quả vẫn "đang học"', async () => {
    await loadDemo(FILES.finalResults, 39);
    expect(await enrollmentOf(919, CSDL)).toMatchObject({
      enrollmentStatus: EnrollmentStatus.REGISTERED,
      attemptOutcome: AttemptOutcome.PENDING,
    });
    expect(await enrollmentOf(918, NNLT)).toMatchObject({ attemptOutcome: AttemptOutcome.PASSED });
  });

  it('không ghi trạng thái học vụ chính thức; nạp lại đúng file đó → bị chặn', async () => {
    const statuses = await ds
      .getRepository(Student)
      .find({ select: { officialAcademicStatus: true }, where: { classId: 'TSTK2411' } });
    expect(statuses.every((s) => s.officialAcademicStatus === OfficialAcademicStatus.ACTIVE)).toBe(
      true,
    );
    await expect(
      uploadAndValidate(ds, `tst-${FILES.quiz}`, demoAcademicCsv(FILES.quiz), 'LMS_QUIZ', HK1),
    ).rejects.toMatchObject({ code: 'DUPLICATE_FILE' });
  });
});

describe('Nạp lại là cập nhật, không nhân đôi', () => {
  it('điểm danh cùng ngày chốt với số liệu mới → cập nhật 1, không đổi 119', async () => {
    const csv = demoAcademicCsv(FILES.attendance).replace(
      'TSTK2411904,Phạm Thị,Dung,TST010239401,,Ngôn ngữ lập trình 1,2025-10-09,45,0,9,20.00',
      'TSTK2411904,Phạm Thị,Dung,TST010239401,,Ngôn ngữ lập trình 1,2025-10-09,45,0,10,22.22',
    );
    expect(csv).not.toBe(demoAcademicCsv(FILES.attendance));
    const staged = await uploadAndValidate(
      ds,
      'tst-diem-danh-sua.csv',
      csv,
      'ATTENDANCE_SUMMARY',
      HK1,
    );
    expect(staged.summary?.courses?.find((c) => c.courseId === NNLT)?.previousSnapshotDate).toBe(
      '2025-10-09',
    );
    const loaded = await confirmAndLoad(ds, staged.id);
    expect(loaded.summary).toMatchObject({ inserted: 0, updated: 1, unchanged: 119 });
    expect(await countIn(AttendanceSummary)).toBe(120);
    expect((await getRollbackEligibility(loaded)).allowed).toBe(false);
  });

  it('bài thực hành: Chưa nộp → Nộp trễ được cập nhật; gia hạn bài → cảnh báo đổi hạn nộp', async () => {
    const csv = demoAcademicCsv(FILES.assignment)
      .replace(
        'TSTK2411908,Bùi Thị,Hoa,TST010239401,,TH01,Thực hành 1: Nhập xuất,2025-09-25,Chưa nộp,',
        'TSTK2411908,Bùi Thị,Hoa,TST010239401,,TH01,Thực hành 1: Nhập xuất,2025-09-25,Nộp trễ,2025-10-12 22:00',
      )
      .replaceAll('Thực hành 3: Vòng lặp,2025-10-14', 'Thực hành 3: Vòng lặp,2025-10-16');
    const staged = await uploadAndValidate(ds, 'tst-thuc-hanh-sua.csv', csv, 'LMS_ASSIGNMENT', HK1);
    expect(staged.errorRows).toBe(0);
    expect(staged.warnings?.map((w) => w.code)).toEqual(['DUE_DATE_CHANGED']);
    const loaded = await confirmAndLoad(ds, staged.id);
    expect(loaded.summary).toMatchObject({ inserted: 0, updated: 2, unchanged: 99 });
    expect(
      await ds.getRepository(LmsActivity).findOneByOrFail({ courseId: NNLT, activityKey: 'TH03' }),
    ).toMatchObject({ dueAt: vn('2025-10-16', '23:59:00') });
    expect(await countIn(LmsAssignmentSubmission)).toBe(100);
  });
});

describe('Dòng lỗi có lý do dễ hiểu', () => {
  const header =
    'mssv,ma_lop_hoc_phan,ten_hoc_phan,ngay_chot,tong_so_tiet,vang_co_phep,vang_khong_phep';

  it('dòng tiêu đề sau 2 dòng tiêu đề phụ vẫn đọc được; mssv lạ, ngày ngoài học kỳ, ngày kiểu Mỹ → lỗi đúng số dòng', async () => {
    const csv = [
      'Danh sách điểm danh lớp học phần TST010240802',
      'Ngày xuất 16/10/2025',
      header,
      'TSTK2411901,TST010240802,Logic học,2025-10-16,30,0,0',
      'TSTK2499999,TST010240802,Logic học,2025-10-16,30,0,0',
      'TSTK2411901,TST010240802,Logic học,2026-01-15,30,0,0',
      'TSTK2411902,TST010240802,Logic học,10/16/2025,30,0,0',
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
      [5, 'STUDENT_NOT_FOUND'],
      [6, 'TERM_MISMATCH'],
      [7, 'INVALID_FORMAT'],
    ]);
    const file = await buildErrorCsv(batch.id);
    expect(file).toContain('Sinh viên TSTK2499999 chưa có trong danh sách');
    expect(file).toContain('YYYY-MM-DD');
  });

  it('cột học kỳ khác học kỳ đã chọn → TERM_MISMATCH', async () => {
    const csv = [
      `${header},hoc_ky`,
      `TSTK2411901,TST010240802,Logic học,2025-10-17,30,0,0,${PREV}`,
      `TSTK2411902,TST010240802,Logic học,2025-10-17,30,0,0,${HK1}`,
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

  it('Admin chọn học phần Logic học → dòng học phần khác bị COURSE_MISMATCH; học phần chưa có → từ chối', async () => {
    const csv = [
      header,
      'TSTK2411901,TST010240802,Logic học,2025-10-18,30,0,0',
      'TSTK2411901,TST010239401,Ngôn ngữ lập trình 1,2025-10-18,45,0,0',
    ].join('\n');
    const { batchId } = await createImportBatch(
      {
        dataType: 'ATTENDANCE_SUMMARY',
        termId: HK1,
        courseId: LOG,
        parentBatchId: null,
        fileName: 'tst-chon-hoc-phan.csv',
        data: Buffer.from(csv, 'utf8'),
      },
      IMPORT_ACTOR,
      noEnqueue,
    );
    await validateImportBatch(batchId);
    expect(
      await ds.getRepository(ImportErrorRow).findOneByOrFail({ importBatchId: batchId }),
    ).toMatchObject({ sourceRowNumber: 3, errorReason: 'COURSE_MISMATCH' });
    await expect(
      createImportBatch(
        {
          dataType: 'ATTENDANCE_SUMMARY',
          termId: HK1,
          courseId: 'TST9999999',
          parentBatchId: null,
          fileName: 'tst-chon-sai.csv',
          data: Buffer.from(`${csv}\n`, 'utf8'),
        },
        IMPORT_ACTOR,
        noEnqueue,
      ),
    ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
  });

  it('hạn nộp lệch giữa các dòng cùng bài → dòng lệch bị INVALID_FORMAT', async () => {
    const csv = [
      'mssv,ma_lop_hoc_phan,ma_bai,ten_bai,han_nop,trang_thai_nop,thoi_diem_nop',
      'TSTK2411901,TST010241001,TH09,Thực hành 9,2025-10-20,Đã nộp,2025-10-18 10:00',
      'TSTK2411902,TST010241001,TH09,Thực hành 9,2025-10-21,Đã nộp,2025-10-18 10:00',
    ].join('\n');
    const batch = await uploadAndValidate(ds, 'tst-han-nop-lech.csv', csv, 'LMS_ASSIGNMENT', HK1);
    expect(batch).toMatchObject({ successRows: 1, errorRows: 1 });
    const error = await ds
      .getRepository(ImportErrorRow)
      .findOneByOrFail({ importBatchId: batch.id });
    expect(error).toMatchObject({ sourceRowNumber: 3, errorReason: 'INVALID_FORMAT' });
    expect(error.errorDetail).toContain('Hạn nộp');
  });

  it('thang điểm 4 lệch điểm chữ (A phải là 3,8) → nạp theo điểm chữ, ghi cảnh báo của lô', async () => {
    const csv = [
      'mssv,ma_lop_hoc_phan,ten_hoc_phan,so_tin_chi,thang_diem_4,diem_chu',
      'TSTK2411920,TST010299501,Học phần thử,2,4.0,A',
    ].join('\n');
    const batch = await uploadAndValidate(ds, 'tst-ket-qua-lech.csv', csv, 'COURSE_RESULT', HK1);
    expect(batch.warnings).toEqual([
      expect.objectContaining({ row: 2, code: 'GRADE_POINT_MISMATCH' }),
    ]);
  });
});

describe('Lần học không phụ thuộc thứ tự nạp file (mã học phần ổn định, mã lớp học phần đổi)', () => {
  let prevBatch: string;

  it('nạp kết quả F học kỳ trước SAU học kỳ này → học phần học kỳ này thành lần 2', async () => {
    const { loaded } = await load(
      'hoc-ky-truoc.csv',
      [
        'mssv,ma_lop_hoc_phan,ten_hoc_phan,so_tin_chi,diem_chu,ngay_cong_bo',
        'TSTK2411915,TST010240801,Logic học,2,F,2025-08-05',
      ],
      'COURSE_RESULT',
      PREV,
    );
    prevBatch = loaded.id;
    expect(await enrollmentOf(915, LOG, PREV)).toMatchObject({
      sectionCode: 'TST010240801',
      attemptOutcome: AttemptOutcome.FAILED,
    });
    expect(await enrollmentOf(915, LOG)).toMatchObject({ attemptNumber: 2 });
  });

  it('hoàn tác lô học kỳ trước → xóa kết quả + Enrollment lô tạo, học kỳ này về lần 1', async () => {
    await rollbackImportBatch(prevBatch, IMPORT_ACTOR, noEnqueue);
    expect(await ds.getRepository(Enrollment).countBy({ termId: PREV })).toBe(0);
    expect(await enrollmentOf(915, LOG)).toMatchObject({ attemptNumber: 1 });
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
