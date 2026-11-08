import { expect } from 'vitest';
import { type DataSource } from 'typeorm';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import { EvaluationTrigger, UserAccountStatus, UserRole } from '@/db/enums';
import {
  processEvaluationRun,
  requestEvaluation,
} from '@/modules/rule-engine/services/evaluation-run.service';
import { cleanupIdentityFixtures } from './identity-fixtures';
import {
  cleanupImportBatches,
  confirmAndLoad,
  demoAcademicCsv,
  demoStudentsCsv,
  IMPORT_ACTOR,
  noEnqueue,
  TEST_CLASSES,
  uploadAndValidate,
} from './import-helpers';

/** Bộ dữ liệu demo v2 (bản sao mã TST) dùng chung cho test tích hợp — docs/demo-data/_luu-tru-v2/KET_QUA_MONG_DOI.md (fixture). */
export const DEMO = {
  hk1: 'TSTHK1_25',
  /** CVHT của lớp TSTK2411 (vai GV001) và TSTH2411 (vai GV002, chưa có sinh viên). */
  advisorA: 'TSTGV001',
  advisorB: 'TSTGV002',
} as const;

export const vn = (date: string, time = '00:00:00') => new Date(`${date}T${time}+07:00`);
export const endOf = (date: string) => vn(date, '23:59:59');

export async function cleanupDemo(ds: DataSource): Promise<void> {
  await cleanupImportBatches(ds);
  await ds.query(`DELETE FROM lms_activities WHERE course_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM enrollments WHERE student_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM courses WHERE course_id LIKE 'TST%'`);
  await cleanupIdentityFixtures(ds);
  await ds.query(`DELETE FROM administrative_classes WHERE class_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM users WHERE user_id IN ($1, $2)`, [DEMO.advisorA, DEMO.advisorB]);
  await ds.query(`DELETE FROM terms WHERE term_id LIKE 'TST%'`);
}

/**
 * Tạo CVHT, lớp, học kỳ thử rồi nạp 6 file của bộ demo v2 (fixture, `_luu-tru-v2/`).
 * `withResults: false`: bỏ 2 file kết quả học phần (học phần còn "đang học" trong DB — VD để
 * đánh dấu rút học phần).
 */
export async function setupDemo(ds: DataSource, { withResults = true } = {}): Promise<void> {
  await cleanupDemo(ds);
  await ds.getRepository(User).insert(
    [DEMO.advisorA, DEMO.advisorB].map((userId) => ({
      userId,
      fullName: `Cố vấn ${userId}`,
      email: `${userId.toLowerCase()}@ctuet.edu.vn`,
      role: UserRole.ADVISOR,
      accountStatus: UserAccountStatus.ACTIVE,
      authUserId: null,
    })),
  );
  await ds.getRepository(AdministrativeClass).insert(
    TEST_CLASSES.map((classId, i) => ({
      classId,
      className: `Lớp thử ${classId}`,
      departmentId: 'K.CNTT',
      cohortYear: '2024',
      advisorId: i === 0 ? DEMO.advisorA : DEMO.advisorB,
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
  await ds.getRepository(Term).insert([term(DEMO.hk1, '2025-08-18', '2025-12-28')]);
  await loadCsv(ds, 'tst-01_sinh_vien.csv', demoStudentsCsv(), 'STUDENT', null);
  for (const [file, type] of withResults ? DEMO_FILES : DEMO_FILES.slice(0, 3)) {
    await loadCsv(ds, `tst-${file}`, demoAcademicCsv(file), type, DEMO.hk1);
  }
}

/** Nạp 1 file thử (2 bước), khẳng định 0 dòng lỗi. */
export async function loadCsv(
  ds: DataSource,
  fileName: string,
  csv: string,
  dataType: string,
  termId: string | null,
) {
  const staged = await uploadAndValidate(ds, fileName, csv, dataType, termId);
  expect(staged.errorRows, fileName).toBe(0);
  return confirmAndLoad(ds, staged.id);
}

/** 5 file học tập của bộ demo v2 (fixture cho test tính năng), đúng thứ tự nạp. */
export const DEMO_FILES = [
  ['02_HK1_2025_diem_danh.csv', 'ATTENDANCE_SUMMARY'],
  ['03_HK1_2025_lms_trac_nghiem.csv', 'LMS_QUIZ'],
  ['04_HK1_2025_lms_thuc_hanh.csv', 'LMS_ASSIGNMENT'],
  ['05_HK1_2025_ket_qua_logic_hoc.csv', 'COURSE_RESULT'],
  ['06_HK1_2025_ket_qua_cuoi_ky.csv', 'COURSE_RESULT'],
] as const;

/** Chạy đánh giá 1 học kỳ tại asOf (mặc định thủ công); email đưa vào `sent` thay vì hàng đợi. */
export async function evaluate(
  termId: string,
  asOf: Date,
  sent: string[] = [],
  trigger: EvaluationTrigger = EvaluationTrigger.MANUAL,
): Promise<string> {
  const runId = await requestEvaluation(
    {
      termId,
      courseId: null,
      trigger,
      asOf,
      actorId: IMPORT_ACTOR,
      importBatchId: null,
    },
    noEnqueue,
  );
  if (!runId) throw new Error('không tạo được lần chạy');
  await processEvaluationRun(runId, (ids) => {
    sent.push(...ids);
    return Promise.resolve();
  });
  return runId;
}
