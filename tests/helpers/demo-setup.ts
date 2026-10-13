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

/** Bộ dữ liệu demo (bản sao mã TST) dùng chung cho test tích hợp Phase 4–5. */
export const DEMO = {
  hk2: 'TSTHK2_25',
  hk1: 'TSTHK1_26',
  /** CVHT của lớp TSTK2311 (vai GV001) và TSTH2311 (vai GV002). */
  advisorA: 'TSTGV001',
  advisorB: 'TSTGV002',
} as const;

export const vn = (date: string, time = '00:00:00') => new Date(`${date}T${time}+07:00`);
export const endOf = (date: string) => vn(date, '23:59:59');

export async function cleanupDemo(ds: DataSource): Promise<void> {
  await cleanupImportBatches(ds);
  await ds.query(`DELETE FROM enrollments WHERE student_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM courses WHERE course_id LIKE 'TST%'`);
  await cleanupIdentityFixtures(ds);
  await ds.query(`DELETE FROM administrative_classes WHERE class_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM users WHERE user_id IN ($1, $2)`, [DEMO.advisorA, DEMO.advisorB]);
  await ds.query(`DELETE FROM terms WHERE term_id LIKE 'TST%'`);
}

/** Tạo CVHT, lớp, học kỳ thử rồi nạp 5 file demo theo thứ tự KET_QUA_MONG_DOI.md. */
export async function setupDemo(ds: DataSource): Promise<void> {
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
      cohortYear: '2023',
      advisorId: i === 0 ? DEMO.advisorA : DEMO.advisorB,
    })),
  );
  const term = (termId: string, start: string, end: string) => ({
    termId,
    termName: `Học kỳ thử ${termId}`,
    academicYear: '2026-2027',
    startDate: vn(start),
    endDate: vn(end, '23:59:59'),
    isCurrent: false,
  });
  await ds
    .getRepository(Term)
    .insert([
      term(DEMO.hk2, '2026-01-05', '2026-05-31'),
      term(DEMO.hk1, '2026-08-17', '2026-12-27'),
    ]);
  await loadCsv(ds, 'tst-01_sinh_vien.csv', demoStudentsCsv(), 'STUDENT', null);
  for (const [file, type, termId] of [
    ['02_HK2_2025_ket_qua_hoc_phan.csv', 'COURSE_RESULT', DEMO.hk2],
    ['03_HK1_2026_diem_danh_tong_hop.csv', 'ATTENDANCE_SUMMARY', DEMO.hk1],
    ['04_HK1_2026_lms_bai_kiem_tra.csv', 'LMS_QUIZ', DEMO.hk1],
    ['05_HK1_2026_ket_qua_giua_ky.csv', 'COURSE_RESULT', DEMO.hk1],
  ] as const) {
    await loadCsv(ds, `tst-${file}`, demoAcademicCsv(file), type, termId);
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

/** Chạy đánh giá thủ công 1 học kỳ tại asOf; email đưa vào `sent` thay vì hàng đợi. */
export async function evaluate(termId: string, asOf: Date, sent: string[] = []): Promise<string> {
  const runId = await requestEvaluation(
    {
      termId,
      courseId: null,
      trigger: EvaluationTrigger.MANUAL,
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
