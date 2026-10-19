import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource, type EntityManager } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { EvaluationRunStatus, EvaluationTrigger, RuleStatus, Severity } from '@/db/enums';
import { getAdminOverview } from '@/modules/admin/services/overview.service';
import { setEnrollmentWithdrawn } from '@/modules/admin/services/enrollment.service';
import { listAdminAlerts } from '@/modules/alerts/services/alert-query.service';
import { syncAlertsForChunk } from '@/modules/alerts/services/alert-sync.service';
import { loadCurrentTriggers } from '@/modules/alerts/services/current-signals';
import { getEvaluationFormOptions } from '@/modules/rule-engine/services/evaluation-query.service';
import { requestEvaluation } from '@/modules/rule-engine/services/evaluation-run.service';
import { cleanupDemo, DEMO, endOf, evaluate, setupDemo } from '../helpers/demo-setup';
import { IMPORT_ACTOR, noEnqueue, useMemoryStorage } from '../helpers/import-helpers';

/**
 * Phase 7 — sửa logic đã chốt 2026-10-15 (docs/rules/05, 07, 08): chạy theo học phần không hạ
 * mức, "dấu hiệu hiện tại" gộp lần chạy học phần, nhãn "không còn dấu hiệu", lịch đêm, lọc Khoa.
 */
let ds: DataSource;

async function alertOf(studentId: string, termId = DEMO.hk1): Promise<Alert> {
  return ds.getRepository(Alert).findOneByOrFail({ studentId, termId });
}

/** Chạy trong transaction rồi hủy — không để lại dữ liệu thử. */
async function inRollback(work: (em: EntityManager) => Promise<void>): Promise<void> {
  await ds
    .transaction(async (em) => {
      await work(em);
      throw new Error('ROLLBACK');
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error) || error.message !== 'ROLLBACK') throw error;
    });
}

/** Lần chạy THEO HỌC PHẦN giả lập, tạo sau lần chạy cả học kỳ. */
async function insertCourseRun(em: EntityManager, courseId: string): Promise<EvaluationRun> {
  const run = em.create(EvaluationRun, {
    termId: DEMO.hk1,
    courseId,
    trigger: EvaluationTrigger.MANUAL,
    asOf: endOf('2025-10-10'),
    triggeredBy: IMPORT_ACTOR,
    importBatchId: null,
    status: EvaluationRunStatus.COMPLETED,
  });
  await em.insert(EvaluationRun, run);
  return run;
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await setupDemo(ds, { withResults: false });
  await evaluate(DEMO.hk1, endOf('2025-10-10'));
});

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Chạy theo 1 học phần không hạ mức cảnh báo', () => {
  it('cảnh báo Rất cao (NNLT 1) + lần chạy học phần khác chỉ có mức Thấp → giữ Rất cao và lần chạy hiện tại', async () => {
    const before = await alertOf('TSTK2411903');
    expect(before.severity).toBe(Severity.CRITICAL);
    await inRollback(async (em) => {
      const run = await insertCourseRun(em, 'TST0102408');
      const result = await syncAlertsForChunk(em, run, [
        {
          studentId: 'TSTK2411903',
          riskScoreLogId: null,
          signals: [
            {
              ruleCode: 'LMS-04',
              scopeId: 'TST0102408',
              severity: Severity.LOW,
              triggerId: randomUUID(),
            },
          ],
        },
      ]);
      expect(result.events).toHaveLength(0);
      const after = await em.findOneByOrFail(Alert, { alertId: before.alertId });
      expect(after.severity).toBe(Severity.CRITICAL);
      expect(after.lastEvaluationRunId).toBe(before.lastEvaluationRunId);
    });
  });

  it('dấu hiệu hiện tại = lần chạy cả học kỳ, học phần chạy riêng sau đó thay đúng học phần đó', async () => {
    const alert = await alertOf('TSTK2411903');
    await inRollback(async (em) => {
      const base = await loadCurrentTriggers(em, [alert]);
      const baseRules = (base.get(alert.alertId) ?? []).map((t) => t.ruleCode).sort();
      expect(baseRules).toEqual(['ATT-01', 'ATT-02']);

      const run = await insertCourseRun(em, 'TST0102394');
      const version = await em.findOneByOrFail(RuleVersion, {
        ruleCode: 'LMS-04',
        status: RuleStatus.ACTIVE,
      });
      const triggerId = randomUUID();
      await em.insert(RuleTrigger, {
        id: triggerId,
        alertId: alert.alertId,
        evaluationRunId: run.id,
        ruleCode: 'LMS-04',
        ruleVersionId: version.id,
        studentId: alert.studentId,
        scopeId: 'TST0102394',
        termId: DEMO.hk1,
        triggeredAt: new Date(),
        inputSnapshot: {},
        reason: 'thử',
        severity: Severity.LOW,
      });
      await syncAlertsForChunk(em, run, [
        {
          studentId: alert.studentId,
          riskScoreLogId: null,
          signals: [
            { ruleCode: 'LMS-04', scopeId: 'TST0102394', severity: Severity.LOW, triggerId },
          ],
        },
      ]);
      const after = await em.findOneByOrFail(Alert, { alertId: alert.alertId });
      const merged = await loadCurrentTriggers(em, [after]);
      expect((merged.get(alert.alertId) ?? []).map((t) => t.ruleCode)).toEqual(['LMS-04']);
      expect(after.severity).toBe(Severity.CRITICAL); // không hạ mức
    });
  });
});

describe('Hết dấu hiệu → giữ cảnh báo, ghi nhận "không còn dấu hiệu"', () => {
  it('rút học phần duy nhất có dấu hiệu → lần chạy cả học kỳ đánh dấu; có lại dấu hiệu → bỏ đánh dấu', async () => {
    const before = await alertOf('TSTK2411904'); // chỉ ATT-01 ở NNLT 1
    expect(before.signalsClearedAt).toBeNull();
    const e = await ds
      .getRepository(Enrollment)
      .findOneByOrFail({ studentId: 'TSTK2411904', courseId: 'TST0102394', termId: DEMO.hk1 });
    const toggle = (withdrawn: boolean) =>
      ds.transaction((em) =>
        setEnrollmentWithdrawn(
          em,
          { studentId: 'TSTK2411904', enrollmentId: e.enrollmentId, withdrawn },
          IMPORT_ACTOR,
        ),
      );

    await toggle(true);
    await evaluate(DEMO.hk1, endOf('2025-10-10'));
    const cleared = await alertOf('TSTK2411904');
    expect(cleared.signalsClearedAt).not.toBeNull();
    expect(cleared.status).toBe(before.status); // không tự đóng
    expect(cleared.severity).toBe(before.severity);
    const list = await listAdminAlerts(DEMO.hk1, 'ALL');
    expect(list.find((a) => a.studentId === 'TSTK2411904')?.signalsClearedAt).not.toBeNull();

    await toggle(false);
    await evaluate(DEMO.hk1, endOf('2025-10-10'));
    expect((await alertOf('TSTK2411904')).signalsClearedAt).toBeNull();
  });
});

describe('Lịch chạy mỗi đêm', () => {
  it('lần chạy theo lịch gộp vào lần đang chờ của cùng phạm vi (không tạo trùng)', async () => {
    const input = {
      termId: DEMO.hk1,
      courseId: null,
      trigger: EvaluationTrigger.SCHEDULED,
      asOf: new Date(),
      actorId: null,
      importBatchId: null,
    };
    const first = await requestEvaluation(input, noEnqueue);
    try {
      expect(first).not.toBeNull();
      expect(await requestEvaluation(input, noEnqueue)).toBeNull();
    } finally {
      if (first) await ds.getRepository(EvaluationRun).delete({ id: first });
    }
  });
});

describe('Lọc theo Khoa', () => {
  it('cảnh báo, tổng quan và danh sách học phần lọc được theo khoa của lớp sinh hoạt', async () => {
    const cntt = await listAdminAlerts(DEMO.hk1, 'ALL', 'K.CNTT');
    expect(cntt.some((a) => a.studentId === 'TSTK2411903')).toBe(true);
    const other = await listAdminAlerts(DEMO.hk1, 'ALL', 'K.KTCK');
    expect(other.some((a) => a.studentId.startsWith('TST'))).toBe(false);

    const overview = await getAdminOverview('K.KTCK');
    expect(overview.studentsByClass.some((c) => c.classId.startsWith('TST'))).toBe(false);

    const options = await getEvaluationFormOptions();
    const course = options.courses.find(
      (c) => c.termId === DEMO.hk1 && c.courseId === 'TST0102394',
    );
    expect(course?.departmentIds).toContain('K.CNTT');
    expect(options.departments.length).toBeGreaterThan(0);
  });
});

// Chạy SAU CÙNG: mốc 30/10 làm `lastAsOf` của cảnh báo mới hơn các lần chạy mốc 10/10 ở trên.
describe('Điểm danh quá hạn → giữ dấu hiệu điểm danh, không hạ mức, không gắn "không còn dấu hiệu"', () => {
  it('mốc 30/10 (điểm danh chốt 09/10 đã quá 14 ngày): cảnh báo dựa trên điểm danh giữ nguyên', async () => {
    const before = await alertOf('TSTK2411903'); // ATT-01 CRITICAL + ATT-02 HIGH ở NNLT 1
    await evaluate(DEMO.hk1, endOf('2025-10-30'));
    const after = await alertOf('TSTK2411903');
    expect(after.severity).toBe(before.severity);
    expect(after.signalsClearedAt).toBeNull();
    const current = await loadCurrentTriggers(ds.manager, [after]);
    expect((current.get(after.alertId) ?? []).map((t) => t.ruleCode).sort()).toEqual([
      'ATT-01',
      'ATT-02',
    ]);
    expect(after.lastAsOf.getTime()).toBe(endOf('2025-10-30').getTime());
  });
});
