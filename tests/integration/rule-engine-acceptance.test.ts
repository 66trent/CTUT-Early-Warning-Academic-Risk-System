import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { RiskScoreLog } from '@/db/entities/risk-score-log.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import {
  EvaluationRunStatus,
  EvaluationTrigger,
  OfficialAcademicStatus,
  RuleStatus,
} from '@/db/enums';
import { att03 } from '@/modules/rule-engine/evaluator/rules/att-03';
import { dryRunRuleVersion } from '@/modules/rule-engine/services/dry-run.service';
import {
  getEvaluationFormOptions,
  getEvaluationRunDetail,
  listEvaluationRuns,
} from '@/modules/rule-engine/services/evaluation-query.service';
import {
  failEvaluationRun,
  processEvaluationRun,
  requestAutoEvaluation,
  requestEvaluation,
} from '@/modules/rule-engine/services/evaluation-run.service';
import {
  activateRuleVersion,
  createRuleVersion,
  loadActiveRuleSet,
  seedRules,
} from '@/modules/rule-engine/services/rule-config.service';
import { cleanupIdentityFixtures } from '../helpers/identity-fixtures';
import {
  cleanupImportBatches,
  confirmAndLoad,
  demoAcademicCsv,
  demoStudentsCsv,
  IMPORT_ACTOR,
  noEnqueue,
  TEST_CLASSES,
  uploadAndValidate,
} from '../helpers/import-helpers';
import { useMemoryStorage } from '../helpers/import-helpers';

/**
 * Test nghiệm thu Phase 4 (docs/rules/02): nạp toàn bộ docs/demo-data (bản sao mã TST) theo
 * thứ tự trong KET_QUA_MONG_DOI.md, chạy đánh giá với 2 mốc asOf, so khớp ĐÚNG và ĐỦ trigger.
 */
let ds: DataSource;
const HK2 = 'TSTHK2_25';
const HK1 = 'TSTHK1_26';
const CLOSED = 'TSTHK3_26';
const vn = (date: string, time = '00:00:00') => new Date(`${date}T${time}+07:00`);
/** Mốc "asOf = ngày X" = hết ngày X giờ Việt Nam. */
const endOf = (date: string) => vn(date, '23:59:59');

// Mã demo → mã thử: KTPM2311xxx → TSTK2311xxx, KHMT2311xxx → TSTH2311xxx, KTPM1xx → TSTC1xx.
const EXPECTED_HK2 = [
  'TSTK2311009|TSTK2311009|ACA-02|CRITICAL',
  'TSTK2311009|TSTK2311009|ACA-03|HIGH',
  'TSTK2311010|TSTK2311010|ACA-02|HIGH',
  'TSTK2311011|TSTK2311011|ACA-03|HIGH',
];
const EXPECTED_HK1 = [
  'TSTK2311002|TSTC201|ATT-01|MEDIUM',
  'TSTK2311003|TSTC201|ATT-01|CRITICAL',
  'TSTK2311003|TSTC201|ATT-02|HIGH',
  'TSTK2311004|TSTC201|ATT-03|LOW',
  'TSTK2311005|TSTC201|LMS-01|HIGH',
  'TSTK2311006|TSTC201|LMS-02|MEDIUM',
  'TSTK2311007|TSTC201|ACA-01|HIGH',
  'TSTK2311008|TSTC201|ATT-01|MEDIUM',
  'TSTK2311008|TSTC201|LMS-01|MEDIUM',
  'TSTK2311008|TSTC201|COMB-01|CRITICAL',
  'TSTK2311009|TSTC103|LMS-01|MEDIUM',
  'TSTK2311009|TSTC103|COMB-02|HIGH',
  'TSTH2311012|TSTC201|ATT-01|HIGH',
];

async function cleanup() {
  await cleanupImportBatches(ds);
  await ds.query(`DELETE FROM enrollments WHERE student_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM courses WHERE course_id LIKE 'TST%'`);
  await cleanupIdentityFixtures(ds);
  await ds.query(`DELETE FROM administrative_classes WHERE class_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM terms WHERE term_id LIKE 'TST%'`);
}

async function load(file: string, dataType: string, termId: string | null, name = file) {
  const csv = dataType === 'STUDENT' ? demoStudentsCsv() : demoAcademicCsv(file);
  const staged = await uploadAndValidate(ds, `tst-${name}`, csv, dataType, termId);
  expect(staged.errorRows).toBe(0);
  return confirmAndLoad(ds, staged.id);
}

/** Chạy đánh giá thủ công 1 học kỳ tại asOf, trả về id lần chạy. */
async function evaluate(termId: string, asOf: Date): Promise<string> {
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
  await processEvaluationRun(runId, noEnqueue);
  return runId;
}

async function triggerKeys(runId: string): Promise<string[]> {
  const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: runId });
  return triggers.map((t) => `${t.studentId}|${t.scopeId}|${t.ruleCode}|${t.severity}`).sort();
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
  const term = (termId: string, start: string, end: string, closedAt: Date | null = null) => ({
    termId,
    termName: `Học kỳ thử ${termId}`,
    academicYear: '2026-2027',
    startDate: vn(start),
    endDate: vn(end, '23:59:59'),
    isCurrent: false,
    closedAt,
  });
  await ds
    .getRepository(Term)
    .insert([
      term(HK2, '2026-01-05', '2026-05-31'),
      term(HK1, '2026-08-17', '2026-12-27'),
      term(CLOSED, '2027-06-01', '2027-07-31', new Date()),
    ]);
  // Thứ tự nạp trong KET_QUA_MONG_DOI.md.
  await load('01_sinh_vien.csv', 'STUDENT', null);
  await load('02_HK2_2025_ket_qua_hoc_phan.csv', 'COURSE_RESULT', HK2);
  await load('03_HK1_2026_diem_danh_tong_hop.csv', 'ATTENDANCE_SUMMARY', HK1);
  await load('04_HK1_2026_lms_bai_kiem_tra.csv', 'LMS_QUIZ', HK1);
  await load('05_HK1_2026_ket_qua_giua_ky.csv', 'COURSE_RESULT', HK1);
});

afterAll(async () => {
  await cleanup();
  await closeDataSource();
});

describe('Nghiệm thu: danh sách cảnh báo mong đợi (KET_QUA_MONG_DOI.md)', () => {
  let hk1RunId: string;

  it('HK2_2025, asOf 2026-06-15 → đúng và đủ 4 trigger', async () => {
    expect(await triggerKeys(await evaluate(HK2, endOf('2026-06-15')))).toEqual(
      EXPECTED_HK2.sort(),
    );
  });

  it('HK1_2026, asOf 2026-10-10 → đúng và đủ 13 trigger', async () => {
    hk1RunId = await evaluate(HK1, endOf('2026-10-10'));
    expect(await triggerKeys(hk1RunId)).toEqual(EXPECTED_HK1.sort());
  });

  it('lần chạy COMPLETED, đủ tiến độ, mỗi sinh viên 1 RiskScore', async () => {
    const run = await ds.getRepository(EvaluationRun).findOneByOrFail({ id: hk1RunId });
    expect(run).toMatchObject({
      status: EvaluationRunStatus.COMPLETED,
      totalStudents: 11,
      processedStudents: 11,
    });
    expect(await ds.getRepository(RiskScoreLog).countBy({ evaluationRunId: hk1RunId })).toBe(11);
  });

  it('lý do dễ hiểu cho CVHT: COMB-02 nêu học kỳ đã rớt, ATT-01 nêu vượt ngưỡng cấm thi', async () => {
    const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: hk1RunId });
    const reason = (student: string, rule: string) =>
      triggers.find((t) => t.studentId === student && t.ruleCode === rule)?.reason ?? '';
    expect(reason('TSTK2311009', 'COMB-02')).toContain(`Học kỳ thử ${HK2}`);
    expect(reason('TSTK2311003', 'ATT-01')).toContain('vượt ngưỡng cấm thi');
    expect(reason('TSTK2311005', 'LMS-01')).toContain('Bỏ 3/3');
  });

  it('chạy lại cùng mốc → cùng kết quả, mỗi lần chạy giữ trigger riêng (không nhân đôi)', async () => {
    const again = await evaluate(HK1, endOf('2026-10-10'));
    expect(await triggerKeys(again)).toEqual(EXPECTED_HK1.sort());
    expect(await ds.getRepository(RuleTrigger).countBy({ evaluationRunId: hk1RunId })).toBe(13);
  });

  it('job chạy lại (retry) cùng lần chạy → xóa kết quả cũ của lần đó rồi tính lại', async () => {
    await ds.getRepository(EvaluationRun).update(hk1RunId, { status: EvaluationRunStatus.RUNNING });
    await processEvaluationRun(hk1RunId, noEnqueue);
    expect(await triggerKeys(hk1RunId)).toEqual(EXPECTED_HK1.sort());
  });

  it('chống rò rỉ thời gian: thêm dữ liệu SAU 10/10 rồi chạy lại mốc 10/10 → kết quả không đổi', async () => {
    const future = [
      'mssv,ma_hoc_phan,ten_hoc_phan,ngay_chot,tong_buoi,co_mat,di_tre,vang_co_phep,vang_khong_phep,tong_buoi_ke_hoach',
      'TSTK2311001,TSTC201,Công nghệ phần mềm,2026-10-23,20,10,0,0,10,30',
    ].join('\n');
    const staged = await uploadAndValidate(
      ds,
      'tst-future-att.csv',
      future,
      'ATTENDANCE_SUMMARY',
      HK1,
    );
    await confirmAndLoad(ds, staged.id);
    const finals = [
      'mssv,ma_hoc_phan,ten_hoc_phan,so_tin_chi,diem_qua_trinh,diem_thi,diem_tong_ket,diem_chu,ket_qua,ngay_cong_bo',
      'TSTK2311007,TSTC201,Công nghệ phần mềm,3,4,2,2.8,F,KHONG_DAT,2026-12-30',
      'TSTK2311001,TSTC201,Công nghệ phần mềm,3,8.5,1,3.2,F,KHONG_DAT,2026-12-30',
    ].join('\n');
    const stagedFinal = await uploadAndValidate(
      ds,
      'tst-future-final.csv',
      finals,
      'COURSE_RESULT',
      HK1,
    );
    await confirmAndLoad(ds, stagedFinal.id);

    expect(await triggerKeys(await evaluate(HK1, endOf('2026-10-10')))).toEqual(
      EXPECTED_HK1.sort(),
    );
    // Mốc sau đó thì thấy dữ liệu mới: KTPM2311001 rớt → ACA-02.
    const later = await triggerKeys(await evaluate(HK1, endOf('2026-12-31')));
    expect(later).toContain('TSTK2311001|TSTK2311001|ACA-02|HIGH');
  });

  it('engine không ghi trạng thái học vụ chính thức của sinh viên', async () => {
    const students = await ds.getRepository(Student).findBy({ classId: 'TSTK2311' });
    expect(students.every((s) => s.officialAcademicStatus === OfficialAcademicStatus.ACTIVE)).toBe(
      true,
    );
  });
});

describe('Lần chạy đánh giá — chặn trùng, học kỳ đã chốt, tự động sau nạp', () => {
  it('đang có lần chạy chờ cùng phạm vi → bấm lần 2 bị từ chối', async () => {
    const input = {
      termId: HK1,
      courseId: null,
      trigger: EvaluationTrigger.MANUAL,
      asOf: new Date(),
      actorId: IMPORT_ACTOR,
      importBatchId: null,
    };
    const first = await requestEvaluation(input, noEnqueue);
    await expect(requestEvaluation(input, noEnqueue)).rejects.toMatchObject({
      code: 'RUN_IN_PROGRESS',
    });
    // Tự động trong lúc đang chờ → gộp vào lần chờ, không tạo thêm.
    expect(await requestAutoEvaluation({ id: 'x', termId: HK1 }, noEnqueue)).toBeNull();
    await processEvaluationRun(first ?? '', noEnqueue);
  });

  it('học kỳ đã chốt → không tạo lần chạy', async () => {
    await expect(
      requestEvaluation(
        {
          termId: CLOSED,
          courseId: null,
          trigger: EvaluationTrigger.MANUAL,
          asOf: new Date(),
          actorId: IMPORT_ACTOR,
          importBatchId: null,
        },
        noEnqueue,
      ),
    ).rejects.toMatchObject({ code: 'TERM_CLOSED' });
  });

  it('nạp lô dữ liệu học tập xong → tự tạo EvaluationRun AUTO_AFTER_IMPORT gắn lô', async () => {
    const csv = [
      'mssv,ma_hoc_phan,ten_hoc_phan,ngay_chot,tong_buoi,co_mat,di_tre,vang_co_phep,vang_khong_phep',
      'TSTK2311002,TSTC201,Công nghệ phần mềm,2026-10-16,18,15,0,1,2',
    ].join('\n');
    const staged = await uploadAndValidate(ds, 'tst-auto-run.csv', csv, 'ATTENDANCE_SUMMARY', HK1);
    const { confirmImportBatch } =
      await import('@/modules/data-import/services/import-batch.service');
    const { loadImportBatch } =
      await import('@/modules/data-import/services/import-processor.service');
    await confirmImportBatch(staged.id, IMPORT_ACTOR, noEnqueue);
    await loadImportBatch(staged.id, {
      retried: false,
      afterReconciled: (batch) => requestAutoEvaluation(batch, noEnqueue),
    });
    const run = await ds.getRepository(EvaluationRun).findOneByOrFail({ importBatchId: staged.id });
    expect(run).toMatchObject({
      trigger: EvaluationTrigger.AUTO_AFTER_IMPORT,
      status: EvaluationRunStatus.QUEUED,
      triggeredBy: null,
      termId: HK1,
    });
    await processEvaluationRun(run.id, noEnqueue);
  });
});

describe('Cấu hình luật — phiên bản mới, chạy thử chỉ đọc, chặn kích hoạt khi chưa chạy thử', () => {
  it('sửa ngưỡng ATT-03 (trễ ≥ 1): tạo phiên bản DRAFT, chưa chạy thử thì không kích hoạt được', async () => {
    // Chạy trong transaction rồi hủy — không để lại phiên bản thử trong DB.
    await ds
      .transaction(async (em) => {
        const draft = await createRuleVersion(
          em,
          'ATT-03',
          { ...att03.defaultCondition, minLate: 1 },
          IMPORT_ACTOR,
        );
        expect(draft).toMatchObject({ status: RuleStatus.DRAFT, lastDryRunAt: null });
        await expect(activateRuleVersion(em, draft.id, IMPORT_ACTOR)).rejects.toMatchObject({
          code: 'DRY_RUN_REQUIRED',
        });
        const triggersBefore = await em.count(RuleTrigger);
        const dry = await dryRunRuleVersion(em, draft.id, HK1, IMPORT_ACTOR, endOf('2026-10-10'));
        // Hiện tại chỉ KTPM2311004 (trễ 3 buổi); ngưỡng 1 buổi thì thêm các sinh viên có đi trễ.
        expect(dry.current.students).toBe(1);
        expect(dry.proposed.students).toBeGreaterThan(dry.current.students);
        expect(await em.count(RuleTrigger)).toBe(triggersBefore); // chỉ đọc
        await activateRuleVersion(em, draft.id, IMPORT_ACTOR);
        const active = await em.findBy(RuleVersion, {
          ruleCode: 'ATT-03',
          status: RuleStatus.ACTIVE,
        });
        expect(active.map((v) => v.id)).toEqual([draft.id]);
        throw new Error('ROLLBACK');
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== 'ROLLBACK') throw error;
      });
    const active = await ds
      .getRepository(RuleVersion)
      .findBy({ ruleCode: 'ATT-03', status: RuleStatus.ACTIVE });
    expect(active).toHaveLength(1);
  });

  it('cấu hình sai cấu trúc → từ chối, không tạo phiên bản', async () => {
    await expect(
      ds.transaction((em) => createRuleVersion(em, 'ATT-01', { bands: [] }, IMPORT_ACTOR)),
    ).rejects.toMatchObject({ code: 'INVALID_CONDITION' });
  });
});

describe('Giao diện Admin — dữ liệu trả ra là object thuần, đúng thứ tự', () => {
  it('chi tiết lần chạy: trigger sắp theo mức giảm dần (CRITICAL trên cùng), RiskScore kèm mức dữ liệu', async () => {
    const runId = await evaluate(HK1, endOf('2026-10-10'));
    const detail = await getEvaluationRunDetail(runId);
    expect(detail).not.toBeNull();
    expect(Object.getPrototypeOf(detail)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(detail?.triggers[0])).toBe(Object.prototype);
    expect(detail?.triggers[0]?.severity).toBe('CRITICAL');
    expect(detail?.triggers.at(-1)?.severity).toBe('LOW');
    expect(detail?.triggers.find((t) => t.ruleCode === 'ACA-01')).toMatchObject({
      studentId: 'TSTK2311007',
      ruleName: 'Điểm quá trình thấp',
      classId: 'TSTK2311',
    });
    expect(detail?.bySeverity.map((s) => s.severity)).toEqual([
      'CRITICAL',
      'HIGH',
      'MEDIUM',
      'LOW',
    ]);
    expect(detail?.risks).toHaveLength(11);
    expect(await getEvaluationRunDetail('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('danh sách lần chạy + lựa chọn form (học kỳ đã chốt bị ẩn)', async () => {
    const { items, total } = await listEvaluationRuns(1);
    expect(total).toBeGreaterThan(0);
    expect(Object.getPrototypeOf(items[0])).toBe(Object.prototype);
    expect(items.some((r) => r.termId === HK1 && r.triggerCount > 0)).toBe(true);
    const options = await getEvaluationFormOptions();
    expect(options.terms.map((t) => t.termId)).toContain(HK1);
    expect(options.terms.map((t) => t.termId)).not.toContain(CLOSED);
  });
});

describe('Seed luật và lỗi lần chạy', () => {
  it('seed lại không tạo trùng; bộ luật ACTIVE đủ 10 luật + RISK-SCORE', async () => {
    await ds.transaction(async (em) => {
      expect(await seedRules(em, IMPORT_ACTOR)).toBe(0);
      const set = await loadActiveRuleSet(em);
      expect([...set.activeRules.keys()].sort()).toHaveLength(10);
      expect(set.config.weights).toEqual({ attendance: 0.4, lms: 0.3, academic: 0.3 });
    });
  });

  it('job lỗi hết số lần thử → lần chạy FAILED kèm lý do', async () => {
    const runId = await requestEvaluation(
      {
        termId: HK2,
        courseId: null,
        trigger: EvaluationTrigger.MANUAL,
        asOf: new Date(),
        actorId: IMPORT_ACTOR,
        importBatchId: null,
      },
      noEnqueue,
    );
    await failEvaluationRun(runId ?? '', 'test');
    expect(
      await ds.getRepository(EvaluationRun).findOneByOrFail({ id: runId ?? '' }),
    ).toMatchObject({ status: EvaluationRunStatus.FAILED });
  });
});
