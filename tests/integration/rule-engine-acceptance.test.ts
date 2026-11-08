import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
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
  Severity,
} from '@/db/enums';
import { att01 } from '@/modules/rule-engine/evaluator/rules/att-01';
import { dryRunRuleVersion } from '@/modules/rule-engine/services/dry-run.service';
import { firstPage } from '@/lib/list-params';
import {
  getEvaluationFormOptions,
  getEvaluationRunDetail,
  listRunFilterOptions,
  listRunStudents,
  listEvaluationRuns,
} from '@/modules/rule-engine/services/evaluation-query.service';
import {
  failEvaluationRun,
  listTermMissingResults,
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
import { cleanupDemo, DEMO, endOf, evaluate, setupDemo, vn } from '../helpers/demo-setup';
import {
  confirmAndLoad,
  IMPORT_ACTOR,
  noEnqueue,
  uploadAndValidate,
  useMemoryStorage,
} from '../helpers/import-helpers';

/**
 * Test nghiệm thu (docs/rules/02): nạp bộ demo v2 (bản sao mã TST) theo thứ tự trong
 * KET_QUA_MONG_DOI.md, chạy 3 mốc (10/10, 20/11, chốt học kỳ 31/12), so khớp ĐÚNG và ĐỦ trigger.
 */
let ds: DataSource;
const HK1 = DEMO.hk1;
const CLOSED = 'TSTHK3_27';

// Mã demo → mã thử: KTPM2411xxx → TSTK2411xxx; học phần tự suy từ mã lớp học phần TST010…
const LOG = 'TST0102408';
const NNLT = 'TST0102394';
const CSDL = 'TST0102410';
const sv = (n: number) => `TSTK2411${n}`;
const key = (n: number, scope: string | null, rule: string, severity: Severity) =>
  `${sv(n)}|${scope ?? sv(n)}|${rule}|${severity}`;
const { LOW, MEDIUM, HIGH, CRITICAL } = Severity;

const EXPECTED_RUN1 = [
  key(902, LOG, 'ATT-01', MEDIUM),
  key(903, NNLT, 'ATT-01', CRITICAL),
  key(903, NNLT, 'ATT-02', HIGH),
  key(904, NNLT, 'ATT-01', HIGH),
  key(905, LOG, 'LMS-01', HIGH),
  key(906, LOG, 'LMS-02', MEDIUM),
  key(908, NNLT, 'LMS-03', HIGH),
  key(909, NNLT, 'LMS-04', LOW),
  key(910, CSDL, 'ATT-01', MEDIUM),
  key(910, CSDL, 'COMB-01', CRITICAL),
  key(910, CSDL, 'LMS-03', MEDIUM),
  key(911, CSDL, 'ATT-01', MEDIUM),
  key(911, CSDL, 'LMS-04', LOW),
  key(913, LOG, 'ATT-01', CRITICAL),
  key(913, LOG, 'ATT-02', HIGH),
].sort();

const EXPECTED_RUN2 = [
  key(908, NNLT, 'LMS-03', HIGH),
  key(909, NNLT, 'LMS-04', LOW),
  key(910, CSDL, 'LMS-03', MEDIUM),
  key(911, CSDL, 'LMS-04', LOW),
  key(912, NNLT, 'LMS-03', MEDIUM),
  key(913, LOG, 'ACA-01', HIGH),
  key(914, LOG, 'ACA-01', HIGH),
  key(919, LOG, 'ACA-01', HIGH),
].sort();

const EXPECTED_RUN3 = [
  key(903, NNLT, 'ACA-01', HIGH),
  key(903, null, 'ACA-02', HIGH),
  key(903, null, 'ACA-03', HIGH),
  key(908, null, 'ACA-03', HIGH),
  key(913, LOG, 'ACA-01', HIGH),
  key(913, null, 'ACA-02', HIGH),
  key(914, LOG, 'ACA-01', HIGH),
  key(914, null, 'ACA-02', HIGH),
  key(915, NNLT, 'ACA-01', HIGH),
  key(915, CSDL, 'ACA-01', HIGH),
  key(915, null, 'ACA-02', CRITICAL),
  key(915, null, 'ACA-03', CRITICAL),
  key(917, null, 'ACA-03', HIGH),
  key(918, CSDL, 'ACA-01', HIGH),
  key(918, null, 'ACA-02', HIGH),
  key(918, null, 'ACA-03', HIGH),
  key(919, LOG, 'ACA-01', HIGH),
  key(919, null, 'ACA-02', HIGH),
  key(919, null, 'ACA-03', HIGH),
].sort();

async function triggerKeys(runId: string): Promise<string[]> {
  const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: runId });
  return triggers.map((t) => `${t.studentId}|${t.scopeId}|${t.ruleCode}|${t.severity}`).sort();
}

async function loadExtra(name: string, csv: string[], dataType: string) {
  const staged = await uploadAndValidate(ds, `tst-${name}`, csv.join('\n'), dataType, HK1);
  expect(staged.errorRows, name).toBe(0);
  return confirmAndLoad(ds, staged.id);
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await setupDemo(ds);
  await ds.getRepository(Term).insert({
    termId: CLOSED,
    termName: `Học kỳ thử ${CLOSED}`,
    academicYear: '2027-2028',
    startDate: vn('2028-06-01'),
    endDate: vn('2028-07-31', '23:59:59'),
    isCurrent: false,
    closedAt: new Date(),
  });
});

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Nghiệm thu: chạy 1 (10/10) và chạy 2 (20/11) — KET_QUA_MONG_DOI.md', () => {
  let run1: string;

  it('chạy 1, asOf 2025-10-10 → đúng và đủ 15 trigger', async () => {
    run1 = await evaluate(HK1, endOf('2025-10-10'));
    expect(await triggerKeys(run1)).toEqual(EXPECTED_RUN1);
  });

  it('lần chạy COMPLETED, đủ tiến độ, mỗi sinh viên 1 RiskScore', async () => {
    const run = await ds.getRepository(EvaluationRun).findOneByOrFail({ id: run1 });
    expect(run).toMatchObject({
      status: EvaluationRunStatus.COMPLETED,
      totalStudents: 20,
      processedStudents: 20,
    });
    expect(await ds.getRepository(RiskScoreLog).countBy({ evaluationRunId: run1 })).toBe(20);
  });

  it('lý do dễ hiểu cho Cố vấn học tập', async () => {
    const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: run1 });
    const reason = (n: number, rule: string) =>
      triggers.find((t) => t.studentId === sv(n) && t.ruleCode === rule)?.reason ?? '';
    expect(reason(903, 'ATT-01')).toContain('Vắng 10/45 tiết');
    expect(reason(903, 'ATT-01')).toContain('vượt ngưỡng cấm thi');
    expect(reason(905, 'LMS-01')).toContain('Bỏ 2/2');
    expect(reason(908, 'LMS-03')).toContain('Không nộp 2/2');
  });

  it('chạy lại cùng mốc → cùng kết quả, mỗi lần chạy giữ trigger riêng; retry tính lại đúng', async () => {
    expect(await triggerKeys(await evaluate(HK1, endOf('2025-10-10')))).toEqual(EXPECTED_RUN1);
    expect(await ds.getRepository(RuleTrigger).countBy({ evaluationRunId: run1 })).toBe(15);
    await ds.getRepository(EvaluationRun).update(run1, { status: EvaluationRunStatus.RUNNING });
    await processEvaluationRun(run1, noEnqueue);
    expect(await triggerKeys(run1)).toEqual(EXPECTED_RUN1);
  });

  it('chống rò rỉ thời gian: dữ liệu SAU 10/10 (điểm danh 23/10, kết quả đã nạp) không đổi kết quả mốc 10/10', async () => {
    await loadExtra(
      'future-att.csv',
      [
        'mssv,ma_lop_hoc_phan,ten_hoc_phan,ngay_chot,tong_so_tiet,vang_co_phep,vang_khong_phep',
        'TSTK2411901,TST010240802,Logic học,2025-10-23,30,0,10',
      ],
      'ATTENDANCE_SUMMARY',
    );
    expect(await triggerKeys(await evaluate(HK1, endOf('2025-10-10')))).toEqual(EXPECTED_RUN1);
  });

  it('chạy 2, asOf 2025-11-20 → đúng và đủ 8 trigger (Logic học đã khóa điểm, điểm danh quá hạn)', async () => {
    expect(await triggerKeys(await evaluate(HK1, endOf('2025-11-20')))).toEqual(EXPECTED_RUN2);
  });

  it('engine không ghi trạng thái học vụ chính thức của sinh viên', async () => {
    const students = await ds.getRepository(Student).findBy({ classId: 'TSTK2411' });
    expect(students).toHaveLength(20);
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
      asOf: endOf('2025-11-20'),
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
      'mssv,ma_lop_hoc_phan,ten_hoc_phan,ngay_chot,tong_so_tiet,vang_co_phep,vang_khong_phep',
      'TSTK2411902,TST010240802,Logic học,2025-10-16,30,1,2',
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

  it('job lỗi hết số lần thử → lần chạy FAILED kèm lý do', async () => {
    const runId = await requestEvaluation(
      {
        termId: HK1,
        courseId: null,
        trigger: EvaluationTrigger.MANUAL,
        asOf: endOf('2025-11-20'),
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

describe('Cấu hình luật — phiên bản mới, chạy thử chỉ đọc, chặn kích hoạt khi chưa chạy thử', () => {
  it('hạ mức đầu của ATT-01 xuống 3%: tạo phiên bản DRAFT, chưa chạy thử thì không kích hoạt được', async () => {
    // Chạy trong transaction rồi hủy — không để lại phiên bản thử trong DB.
    const [first, ...rest] = att01.defaultCondition.bands;
    await ds
      .transaction(async (em) => {
        const draft = await createRuleVersion(
          em,
          'ATT-01',
          { ...att01.defaultCondition, bands: [{ ...first, percent: 3 }, ...rest] },
          IMPORT_ACTOR,
        );
        expect(draft).toMatchObject({ status: RuleStatus.DRAFT, lastDryRunAt: null });
        await expect(activateRuleVersion(em, draft.id, IMPORT_ACTOR)).rejects.toMatchObject({
          code: 'DRY_RUN_REQUIRED',
        });
        const triggersBefore = await em.count(RuleTrigger);
        const dry = await dryRunRuleVersion(em, draft.id, HK1, IMPORT_ACTOR, endOf('2025-10-10'));
        // Hiện tại 6 sinh viên (902, 903, 904, 910, 911, 913); ngưỡng 3% thêm 907, 920.
        expect(dry.current.students).toBe(6);
        expect(dry.proposed.students).toBe(8);
        expect(await em.count(RuleTrigger)).toBe(triggersBefore); // chỉ đọc
        await activateRuleVersion(em, draft.id, IMPORT_ACTOR);
        const active = await em.findBy(RuleVersion, {
          ruleCode: 'ATT-01',
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
      .findBy({ ruleCode: 'ATT-01', status: RuleStatus.ACTIVE });
    expect(active).toHaveLength(1);
  });

  it('cấu hình sai cấu trúc → từ chối, không tạo phiên bản', async () => {
    await expect(
      ds.transaction((em) => createRuleVersion(em, 'ATT-01', { bands: [] }, IMPORT_ACTOR)),
    ).rejects.toMatchObject({ code: 'INVALID_CONDITION' });
  });

  it('seed lại không tạo trùng; bộ luật ACTIVE đủ 12 luật + RISK-SCORE (A = 3,8)', async () => {
    await ds.transaction(async (em) => {
      expect(await seedRules(em, IMPORT_ACTOR)).toBe(0);
      const set = await loadActiveRuleSet(em);
      expect([...set.activeRules.keys()].sort()).toHaveLength(12);
      expect(set.config.weights).toEqual({ attendance: 0.4, lms: 0.3, academic: 0.3 });
      expect(set.config.academic.gradeScale.A).toBe(3.8);
    });
  });
});

describe('Giao diện Admin — dữ liệu trả ra là object thuần, đúng thứ tự', () => {
  it('kết quả lần chạy theo sinh viên: mức cao nhất trước, kèm dấu hiệu, RiskScore, mức dữ liệu', async () => {
    const runId = await evaluate(HK1, endOf('2025-10-10'));
    const detail = await getEvaluationRunDetail(runId);
    expect(detail).not.toBeNull();
    expect(Object.getPrototypeOf(detail)).toBe(Object.prototype);
    expect(detail?.bySeverity.map((s) => s.severity)).toEqual([
      'CRITICAL',
      'HIGH',
      'MEDIUM',
      'LOW',
    ]);
    expect(detail?.triggerCount).toBe(detail?.bySeverity.reduce((sum, s) => sum + s.count, 0));

    const withSignals = await listRunStudents(runId, { all: false }, firstPage({ size: 100 }));
    expect(withSignals.total).toBe(detail?.studentsWithSignals);
    const first = withSignals.items[0];
    expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
    expect(first?.maxSeverity).toBe('CRITICAL');
    expect(withSignals.items.every((r) => r.signalCount > 0)).toBe(true);
    expect(withSignals.items.reduce((sum, r) => sum + r.signals.length, 0)).toBe(
      detail?.triggerCount,
    );
    const s908 = withSignals.items.find((r) => r.studentId === sv(908));
    expect(s908).toMatchObject({ classId: 'TSTK2411' });
    expect(s908?.signals.find((t) => t.ruleCode === 'LMS-03')).toMatchObject({
      ruleName: 'Không nộp bài thực hành',
    });

    const all = await listRunStudents(runId, { all: true }, firstPage({ size: 100 }));
    expect(all.total).toBe(20);
    expect(all.items.every((r) => r.level !== undefined)).toBe(true);
    const lms03 = await listRunStudents(runId, { all: false, ruleCode: 'LMS-03' });
    expect(lms03.items.map((r) => r.studentId)).toContain(sv(908));
    const page2 = await listRunStudents(runId, { all: true }, firstPage({ size: 20, page: 2 }));
    expect(page2).toMatchObject({ items: [], total: 20 });
    const options = await listRunFilterOptions(runId);
    expect(options.classes).toEqual(['TSTK2411']);
    expect(options.rules.map((r) => r.ruleCode)).toContain('LMS-03');
    expect(await getEvaluationRunDetail('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('danh sách lần chạy + lựa chọn form (học kỳ đã chốt bị ẩn)', async () => {
    const { items, total } = await listEvaluationRuns();
    expect(total).toBeGreaterThan(0);
    expect(Object.getPrototypeOf(items[0])).toBe(Object.prototype);
    expect(items.some((r) => r.termId === HK1 && r.triggerCount > 0)).toBe(true);
    const options = await getEvaluationFormOptions();
    expect(options.terms.map((t) => t.termId)).toContain(HK1);
    expect(options.terms.map((t) => t.termId)).not.toContain(CLOSED);
  });
});

describe('Nghiệm thu: chạy 3 — chốt học kỳ (TERM_CLOSING, asOf 31/12)', () => {
  it('trước khi chốt: liệt kê đúng sinh viên còn học phần chưa có kết quả', async () => {
    const missing = await listTermMissingResults(HK1);
    expect(missing).toEqual([
      {
        studentId: sv(919),
        fullName: 'Tạ Văn Uy',
        classId: 'TSTK2411',
        courses: [{ courseId: CSDL, courseName: 'Cơ sở dữ liệu' }],
      },
    ]);
    expect(Object.getPrototypeOf(missing[0])).toBe(Object.prototype);
  });

  it('lần chạy cuối → đúng và đủ 19 trigger (ACA-02/03 tính trên học phần đã có); học kỳ được chốt', async () => {
    const runId = await evaluate(HK1, endOf('2025-12-31'), [], EvaluationTrigger.TERM_CLOSING);
    expect(await triggerKeys(runId)).toEqual(EXPECTED_RUN3);
    const reason919 = (
      await ds
        .getRepository(RuleTrigger)
        .findOneByOrFail({ evaluationRunId: runId, studentId: sv(919), ruleCode: 'ACA-02' })
    ).reason;
    expect(reason919).toContain('Còn 1 học phần chưa có kết quả');
    expect((await ds.getRepository(Term).findOneByOrFail({ termId: HK1 })).closedAt).not.toBeNull();
    await expect(
      requestEvaluation(
        {
          termId: HK1,
          courseId: null,
          trigger: EvaluationTrigger.MANUAL,
          asOf: endOf('2025-12-31'),
          actorId: IMPORT_ACTOR,
          importBatchId: null,
        },
        noEnqueue,
      ),
    ).rejects.toMatchObject({ code: 'TERM_CLOSED' });
  });
});
