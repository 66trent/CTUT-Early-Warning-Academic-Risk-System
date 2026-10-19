import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource, type EntityManager } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AuditLog } from '@/db/entities/audit-log.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { EnrollmentStatus, EvaluationTrigger, RuleStatus } from '@/db/enums';
import { listAuditLogs, auditFilterSchema } from '@/modules/admin/services/audit-log.service';
import { setEnrollmentWithdrawn } from '@/modules/admin/services/enrollment.service';
import { getSetupCounts } from '@/modules/admin/services/getting-started.service';
import { getAdminOverview } from '@/modules/admin/services/overview.service';
import { firstPage } from '@/lib/list-params';
import {
  foldVietnamese,
  quickSearchStudents,
  searchStudents,
} from '@/modules/admin/services/student-search.service';
import {
  DEFAULT_RISK_SCORE_CONFIG,
  RISK_SCORE_RULE_CODE,
} from '@/modules/rule-engine/evaluator/config';
import { att01 } from '@/modules/rule-engine/evaluator/rules/att-01';
import { lms04 } from '@/modules/rule-engine/evaluator/rules/lms-04';
import { dryRunRuleVersion } from '@/modules/rule-engine/services/dry-run.service';
import { getEvaluationFormOptions } from '@/modules/rule-engine/services/evaluation-query.service';
import {
  processEvaluationRun,
  requestEvaluation,
} from '@/modules/rule-engine/services/evaluation-run.service';
import {
  createRuleVersion,
  discardRuleVersion,
} from '@/modules/rule-engine/services/rule-config.service';
import { getRuleDetail, listRules } from '@/modules/rule-engine/services/rule-query.service';
import { cleanupDemo, DEMO, endOf, evaluate, loadCsv, setupDemo } from '../helpers/demo-setup';
import { IMPORT_ACTOR, noEnqueue, useMemoryStorage } from '../helpers/import-helpers';

/**
 * Phase 6 — quản trị và vận hành: cấu hình luật (chạy thử so sánh, bỏ nháp), rút học phần,
 * nhật ký kiểm toán, chạy đánh giá theo học phần, tổng quan, trang "Bắt đầu".
 */
let ds: DataSource;

/** DTO trả cho Client Component phải là object thuần (docs/rules/01). */
function expectPlain(value: unknown) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  for (const item of Array.isArray(value) ? value : [value]) {
    expect(Object.getPrototypeOf(item)).toBe(Object.prototype);
  }
}

/** Chạy trong transaction rồi hủy — không để lại phiên bản thử trong DB. */
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

async function enrollmentOf(studentId: string, courseId: string, termId: string) {
  return ds.getRepository(Enrollment).findOneByOrFail({ studentId, courseId, termId });
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  // Không nạp kết quả học phần: học phần còn "đang học" để đánh dấu rút được.
  await setupDemo(ds, { withResults: false });
});

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Cấu hình luật — danh sách, chi tiết, chạy thử so sánh, bỏ nháp', () => {
  it('danh sách 12 luật + RISK-SCORE kèm phiên bản đang áp dụng; chi tiết có cấu trúc form', async () => {
    const rules = await listRules();
    expectPlain(rules);
    expect(rules.map((r) => r.ruleCode)).toEqual(
      expect.arrayContaining(['ATT-01', 'LMS-02', 'COMB-02', RISK_SCORE_RULE_CODE]),
    );
    expect(rules.every((r) => r.activeVersion !== null)).toBe(true);

    const detail = await getRuleDetail('ATT-01');
    expectPlain(detail);
    expect(detail?.schema.properties?.bands?.type).toBe('array');
    expect(detail?.active?.status).toBe(RuleStatus.ACTIVE);
    expect(await getRuleDetail('KHONG-CO')).toBeNull();
  });

  it('chạy thử ATT-01 hạ mức đầu xuống 3%: liệt kê sinh viên thêm vào, chỉ đọc', async () => {
    const [first, ...rest] = att01.defaultCondition.bands;
    await inRollback(async (em) => {
      const draft = await createRuleVersion(
        em,
        'ATT-01',
        { ...att01.defaultCondition, bands: [{ ...first, percent: 3 }, ...rest] },
        IMPORT_ACTOR,
      );
      await expect(
        createRuleVersion(em, 'ATT-01', att01.defaultCondition, IMPORT_ACTOR),
      ).rejects.toMatchObject({ code: 'DRAFT_EXISTS' });

      const triggersBefore = await em.count(RuleTrigger);
      const dry = await dryRunRuleVersion(
        em,
        draft.id,
        DEMO.hk1,
        IMPORT_ACTOR,
        endOf('2025-10-10'),
      );
      expectPlain(dry);
      expect(dry.studentsEvaluated).toBe(20);
      expect(dry.current.students).toBe(6);
      expect(dry.added.map((s) => s.studentId).sort()).toEqual(['TSTK2411907', 'TSTK2411920']);
      expect(dry.addedCount).toBe(dry.proposed.students - dry.current.students);
      expect(dry.added.every((s) => s.fullName && s.classId)).toBe(true);
      expect(dry.removedCount).toBe(0);
      expect(await em.count(RuleTrigger)).toBe(triggersBefore);
    });
  });

  it('chạy thử RISK-SCORE: không đổi luật thì số sinh viên có dấu hiệu giữ nguyên', async () => {
    await inRollback(async (em) => {
      const draft = await createRuleVersion(
        em,
        RISK_SCORE_RULE_CODE,
        { ...DEFAULT_RISK_SCORE_CONFIG, weights: { attendance: 1, lms: 0, academic: 0 } },
        IMPORT_ACTOR,
      );
      const dry = await dryRunRuleVersion(
        em,
        draft.id,
        DEMO.hk1,
        IMPORT_ACTOR,
        endOf('2025-10-10'),
      );
      expect(dry.proposed.students).toBe(dry.current.students);
      expect(dry.current.students).toBeGreaterThan(0);
      expect(dry.addedCount + dry.removedCount).toBe(0);
      expect(dry.current.averageRisk).not.toBeNull();
    });
  });

  it('bỏ bản nháp → ARCHIVED (giữ lịch sử), ghi Audit Log; không bỏ được bản đang áp dụng', async () => {
    await inRollback(async (em) => {
      const draft = await createRuleVersion(em, 'LMS-04', lms04.defaultCondition, IMPORT_ACTOR);
      await discardRuleVersion(em, draft.id, IMPORT_ACTOR);
      expect(await em.findOneByOrFail(RuleVersion, { id: draft.id })).toMatchObject({
        status: RuleStatus.ARCHIVED,
      });
      expect(
        await em.countBy(AuditLog, { action: 'RULE_VERSION_DISCARDED', targetId: draft.id }),
      ).toBe(1);
      const active = await em.findOneByOrFail(RuleVersion, {
        ruleCode: 'LMS-04',
        status: RuleStatus.ACTIVE,
      });
      await expect(discardRuleVersion(em, active.id, IMPORT_ACTOR)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
      // Bỏ nháp xong thì tạo được bản nháp mới.
      await createRuleVersion(em, 'LMS-04', lms04.defaultCondition, IMPORT_ACTOR);
    });
  });
});

describe('Rút học phần — Admin đánh dấu / bỏ đánh dấu, có Audit Log', () => {
  it('đánh dấu rút → lần chạy sau bỏ qua học phần đó; bỏ đánh dấu → xét lại', async () => {
    const e = await enrollmentOf('TSTK2411903', 'TST0102394', DEMO.hk1);
    const input = { studentId: 'TSTK2411903', enrollmentId: e.enrollmentId };
    await ds.transaction((em) =>
      setEnrollmentWithdrawn(em, { ...input, withdrawn: true }, IMPORT_ACTOR),
    );
    expect((await enrollmentOf('TSTK2411903', 'TST0102394', DEMO.hk1)).enrollmentStatus).toBe(
      EnrollmentStatus.WITHDRAWN,
    );
    await expect(
      ds.transaction((em) =>
        setEnrollmentWithdrawn(em, { ...input, withdrawn: true }, IMPORT_ACTOR),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' });

    const runId = await evaluate(DEMO.hk1, endOf('2025-10-10'));
    const triggers = await ds
      .getRepository(RuleTrigger)
      .findBy({ evaluationRunId: runId, studentId: 'TSTK2411903' });
    expect(triggers).toHaveLength(0); // ATT-01, ATT-02 đều ở Ngôn ngữ lập trình 1 — đã rút

    await ds.transaction((em) =>
      setEnrollmentWithdrawn(em, { ...input, withdrawn: false }, IMPORT_ACTOR),
    );
    expect((await enrollmentOf('TSTK2411903', 'TST0102394', DEMO.hk1)).enrollmentStatus).toBe(
      EnrollmentStatus.REGISTERED,
    );
    const logs = await ds.getRepository(AuditLog).findBy({ targetId: e.enrollmentId });
    expect(logs.map((l) => l.action).sort()).toEqual([
      'ENROLLMENT_WITHDRAWAL_UNDONE',
      'ENROLLMENT_WITHDRAWN',
    ]);
    expect(logs[0]?.detail).toMatchObject({ studentId: 'TSTK2411903', courseId: 'TST0102394' });
  });

  it('từ chối: sai sinh viên, học phần đã có điểm cuối kỳ, học kỳ đã chốt', async () => {
    const e = await enrollmentOf('TSTK2411903', 'TST0102394', DEMO.hk1);
    await expect(
      ds.transaction((em) =>
        setEnrollmentWithdrawn(
          em,
          { studentId: 'TSTK2411901', enrollmentId: e.enrollmentId, withdrawn: true },
          IMPORT_ACTOR,
        ),
      ),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });

    await loadCsv(
      ds,
      'tst-p6-ket-qua.csv',
      [
        'mssv,ma_lop_hoc_phan,ten_hoc_phan,so_tin_chi,diem_chu,ngay_cong_bo',
        'TSTK2411901,TST010240802,Logic học,2,B,2025-11-16',
      ].join('\n'),
      'COURSE_RESULT',
      DEMO.hk1,
    );
    const completed = await ds.getRepository(Enrollment).findOneByOrFail({
      termId: DEMO.hk1,
      enrollmentStatus: EnrollmentStatus.COMPLETED,
    });
    const target = { studentId: completed.studentId, enrollmentId: completed.enrollmentId };
    await expect(
      ds.transaction((em) =>
        setEnrollmentWithdrawn(em, { ...target, withdrawn: true }, IMPORT_ACTOR),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' });

    await ds.getRepository(Term).update({ termId: DEMO.hk1 }, { closedAt: new Date() });
    try {
      await expect(
        ds.transaction((em) =>
          setEnrollmentWithdrawn(em, { ...target, withdrawn: true }, IMPORT_ACTOR),
        ),
      ).rejects.toMatchObject({ code: 'TERM_CLOSED' });
    } finally {
      await ds.getRepository(Term).update({ termId: DEMO.hk1 }, { closedAt: null });
    }
  });
});

describe('Nhật ký kiểm toán — lọc, chỉ đọc', () => {
  it('lọc theo hành động + đối tượng (MSSV trong chi tiết) + người thực hiện; ngày tương lai → rỗng', async () => {
    const filter = auditFilterSchema.parse({
      action: 'ENROLLMENT_WITHDRAWN',
      target: 'TSTK2411903',
      actor: IMPORT_ACTOR,
    });
    const { items, total } = await listAuditLogs(filter);
    expectPlain(items);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items.every((i) => i.action === 'ENROLLMENT_WITHDRAWN')).toBe(true);
    expect(items[0]?.detail).toEqual(
      expect.arrayContaining([{ key: 'studentId', value: 'TSTK2411903' }]),
    );

    const future = await listAuditLogs(
      auditFilterSchema.parse({ target: 'TSTK2411903', from: '2999-01-01' }),
    );
    expect(future.total).toBe(0);
  });

  it('giá trị lọc sai bị bỏ qua thay vì báo lỗi; ký tự % không phải ký tự đại diện', async () => {
    expect(auditFilterSchema.parse({ action: 'XOA_HET', from: '13/10/2026', page: '-3' })).toEqual({
      action: undefined,
      from: undefined,
      to: undefined,
      actor: undefined,
      target: undefined,
    });
    const wildcard = await listAuditLogs(auditFilterSchema.parse({ target: '%TSTK2411903%' }));
    expect(wildcard.total).toBe(0);
  });
});

describe('Tìm nhanh Ctrl+K', () => {
  it('gõ không dấu tìm được họ tên có dấu; MSSV khớp đầu chuỗi lên trước; tối đa 8', async () => {
    expect(foldVietnamese('Lê Văn Cường ĐỨC')).toBe('le van cuong duc');
    const byName = await quickSearchStudents('le van cuong', null);
    expect(byName.map((s) => s.studentId)).toContain('TSTK2411903');
    expectPlain(byName);
    const byId = await quickSearchStudents('tstk24119', null);
    expect(byId.length).toBeLessThanOrEqual(8);
    expect(byId.every((s) => s.studentId.startsWith('TSTK24119'))).toBe(true);
    expect(await quickSearchStudents('a', null)).toEqual([]);
    expect(await quickSearchStudents('%%', null)).toEqual([]);
  });

  it('Cố vấn học tập chỉ thấy sinh viên lớp mình phụ trách', async () => {
    expect((await quickSearchStudents('TSTK2411903', DEMO.advisorA)).length).toBe(1);
    expect(await quickSearchStudents('TSTK2411903', DEMO.advisorB)).toEqual([]);
  });
});

describe('Chạy đánh giá theo học phần', () => {
  it('form có danh sách học phần theo học kỳ; học phần không có trong học kỳ → từ chối', async () => {
    const options = await getEvaluationFormOptions();
    expectPlain(options.courses);
    expect(options.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ termId: DEMO.hk1, courseId: 'TST0102394' }),
      ]),
    );
    await expect(
      requestEvaluation(
        {
          termId: DEMO.hk1,
          courseId: 'TSTKHONGCO',
          trigger: EvaluationTrigger.MANUAL,
          asOf: endOf('2025-10-10'),
          actorId: IMPORT_ACTOR,
          importBatchId: null,
        },
        noEnqueue,
      ),
    ).rejects.toMatchObject({ code: 'COURSE_NOT_IN_TERM' });
  });

  it('chỉ xét sinh viên của học phần đã chọn', async () => {
    const runId = await requestEvaluation(
      {
        termId: DEMO.hk1,
        courseId: 'TST0102408',
        trigger: EvaluationTrigger.MANUAL,
        asOf: endOf('2025-10-10'),
        actorId: IMPORT_ACTOR,
        importBatchId: null,
      },
      noEnqueue,
    );
    if (!runId) throw new Error('không tạo được lần chạy');
    await processEvaluationRun(runId, () => Promise.resolve());
    const run = await ds.getRepository(EvaluationRun).findOneByOrFail({ id: runId });
    const enrolled = await ds
      .getRepository(Enrollment)
      .countBy({ termId: DEMO.hk1, courseId: 'TST0102408' });
    expect(run.totalStudents).toBe(enrolled);
    const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: runId });
    expect(triggers.every((t) => t.scopeId === 'TST0102408')).toBe(true);
  });
});

describe('Tổng quan Admin, trang "Bắt đầu", tìm sinh viên', () => {
  it('tổng quan: sĩ số theo lớp đếm đúng, dữ liệu là object thuần', async () => {
    const overview = await getAdminOverview();
    expectPlain(overview);
    const testClass = overview.studentsByClass.find((c) => c.classId === 'TSTK2411');
    const actual = await ds.getRepository(Student).countBy({ classId: 'TSTK2411' });
    expect(testClass?.students).toBe(actual);
    expect(overview.alertsBySeverity.map((s) => s.severity)).toEqual([
      'CRITICAL',
      'HIGH',
      'MEDIUM',
      'LOW',
    ]);
  });

  it('số liệu trang "Bắt đầu" có đủ trường, đếm được sinh viên đã nhập', async () => {
    const counts = await getSetupCounts();
    expectPlain(counts);
    expect(counts.departments).toBeGreaterThan(0);
    expect(counts.students).toBeGreaterThanOrEqual(20);
    expect(counts.classes).toBeGreaterThanOrEqual(2);
  });

  it('tìm sinh viên theo mã hoặc họ tên, % không phải ký tự đại diện', async () => {
    const byId = await searchStudents('TSTK241190');
    expectPlain(byId.items);
    expect(byId.items.map((s) => s.studentId)).toContain('TSTK2411903');
    expect((await searchStudents('%')).total).toBe(0);
  });

  it('phân trang + sắp xếp phía server: trang cuối, trang vượt quá, khóa sắp xếp', async () => {
    const all = await searchStudents('TSTK', firstPage({ size: 100 }));
    expect(all.total).toBeGreaterThan(2);
    const size = 20;
    const last = Math.ceil(all.total / size);
    const lastPage = await searchStudents('TSTK', firstPage({ page: last, size }));
    expect(lastPage.items.length).toBe(all.total - (last - 1) * size);
    expectPlain(lastPage.items);
    const beyond = await searchStudents('TSTK', firstPage({ page: last + 1, size }));
    expect(beyond).toMatchObject({ items: [], total: all.total, page: last + 1 });
    const desc = await searchStudents(
      'TSTK',
      firstPage({ size: 100, sort: 'studentId', dir: 'desc' }),
    );
    const ids = desc.items.map((s) => s.studentId);
    expect(ids).toEqual([...ids].sort().reverse());
  });
});
