import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { Notification } from '@/db/entities/notification.entity';
import { RiskScoreLog } from '@/db/entities/risk-score-log.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { Term } from '@/db/entities/term.entity';
import {
  AlertStatus,
  ConfidentialityLevel,
  DataCompletenessLevel,
  EvaluationTrigger,
  InterventionType,
  NotificationChannel,
  Severity,
} from '@/db/enums';
import { setEnrollmentWithdrawn } from '@/modules/admin/services/enrollment.service';
import {
  changeAlertStatus,
  recordIntervention,
} from '@/modules/alerts/services/alert-lifecycle.service';
import { listTermMissingResults } from '@/modules/rule-engine/services/evaluation-run.service';
import { endOf, evaluate } from '../helpers/demo-setup';
import {
  cleanupDemoV3,
  setupDemoV3,
  V3,
  V3_CLASSES,
  type V3Class,
  v3course,
  v3sv,
} from '../helpers/demo-v3';
import { IMPORT_ACTOR, useMemoryStorage } from '../helpers/import-helpers';

/**
 * Nghiệm thu bộ demo v3 (docs/rules/02): nạp TOÀN BỘ docs/demo-data (bản sao mã TST) theo
 * KET_QUA_MONG_DOI.md, chạy 3 mốc, so khớp ĐÚNG và ĐỦ dấu hiệu của 100 sinh viên (thừa / thiếu đều
 * lỗi), cảnh báo, thông báo, mức đủ dữ liệu, vòng đời KHMT, rút học phần KHDL.
 */
let ds: DataSource;
const { LOW, MEDIUM, HIGH, CRITICAL } = Severity;

// Học phần (mã thật → mã thử).
const LOG = v3course('0101002408');
const HQT = v3course('0101000900');
const PTTK = v3course('0101000902');
const KTMT = v3course('0101000890');
const MANG = v3course('0101000892');
const CSDL = v3course('0101000894');
const GT = v3course('0101002318');
const TTNT = v3course('0101000896');
const TTHCM = v3course('0101002336');
const PTCSDL = v3course('0101002299');

type Row = [V3Class, number, string | null, string, Severity];
const key = ([cls, n, scope, rule, severity]: Row) =>
  `${v3sv(cls, n)}|${scope ?? v3sv(cls, n)}|${rule}|${severity}`;
const keys = (rows: Row[]) => rows.map(key).sort();

const K = 'KTPM2411' as const;
const C = 'CNTT2411' as const;
const T = 'HTTT2411' as const;
const M = 'KHMT2411' as const;
const D = 'KHDL2411' as const;

const RUN1 = keys([
  [K, 902, LOG, 'ATT-01', MEDIUM],
  [K, 903, HQT, 'ATT-01', CRITICAL],
  [K, 903, HQT, 'ATT-02', HIGH],
  [K, 904, HQT, 'ATT-01', HIGH],
  [K, 905, LOG, 'LMS-01', HIGH],
  [K, 906, LOG, 'LMS-02', MEDIUM],
  [K, 908, HQT, 'LMS-03', HIGH],
  [K, 909, HQT, 'LMS-04', LOW],
  [K, 910, PTTK, 'ATT-01', MEDIUM],
  [K, 910, PTTK, 'LMS-03', MEDIUM],
  [K, 910, PTTK, 'COMB-01', CRITICAL],
  [K, 911, PTTK, 'ATT-01', MEDIUM],
  [K, 911, PTTK, 'LMS-04', LOW],
  [K, 913, LOG, 'ATT-01', CRITICAL],
  [K, 913, LOG, 'ATT-02', HIGH],
  [C, 903, KTMT, 'LMS-01', HIGH],
  [C, 903, MANG, 'LMS-03', HIGH],
  [C, 904, LOG, 'LMS-01', MEDIUM],
  [C, 905, KTMT, 'LMS-02', MEDIUM],
  [C, 907, MANG, 'LMS-04', LOW],
  [C, 908, KTMT, 'LMS-01', MEDIUM],
  [C, 908, KTMT, 'LMS-03', MEDIUM],
  [C, 908, KTMT, 'COMB-01', CRITICAL],
  [T, 903, CSDL, 'ATT-01', MEDIUM],
  [T, 903, CSDL, 'COMB-02', HIGH],
  [T, 904, CSDL, 'LMS-03', HIGH],
  [T, 904, CSDL, 'COMB-02', CRITICAL],
  [M, 903, TTNT, 'ATT-01', MEDIUM],
  [M, 903, TTNT, 'LMS-01', MEDIUM],
  [M, 903, TTNT, 'LMS-03', MEDIUM],
  [M, 903, TTNT, 'COMB-01', CRITICAL],
  [M, 904, GT, 'ATT-01', HIGH],
  [M, 904, GT, 'ATT-02', HIGH],
  [M, 904, GT, 'LMS-02', MEDIUM],
  [M, 904, GT, 'COMB-01', CRITICAL],
  [M, 905, TTNT, 'LMS-03', MEDIUM],
  [M, 906, TTNT, 'LMS-01', HIGH],
  [M, 908, TTNT, 'ATT-01', MEDIUM],
  [M, 908, TTNT, 'LMS-04', LOW],
  [D, 903, PTCSDL, 'ATT-01', CRITICAL],
  [D, 905, TTHCM, 'LMS-01', MEDIUM],
]);

const RUN2 = keys([
  [K, 908, HQT, 'LMS-03', HIGH],
  [K, 909, HQT, 'LMS-04', LOW],
  [K, 910, PTTK, 'LMS-03', MEDIUM],
  [K, 911, PTTK, 'LMS-04', LOW],
  [K, 912, HQT, 'LMS-03', MEDIUM],
  [K, 913, LOG, 'ACA-01', HIGH],
  [K, 914, LOG, 'ACA-01', HIGH],
  [K, 919, LOG, 'ACA-01', HIGH],
  [C, 903, KTMT, 'LMS-01', HIGH],
  [C, 903, MANG, 'LMS-03', HIGH],
  [C, 905, KTMT, 'LMS-02', MEDIUM],
  [C, 907, MANG, 'LMS-04', LOW],
  [C, 908, KTMT, 'LMS-01', MEDIUM],
  [C, 908, KTMT, 'LMS-03', MEDIUM],
  [C, 908, KTMT, 'COMB-01', CRITICAL],
  [C, 909, MANG, 'LMS-03', MEDIUM],
  [T, 904, CSDL, 'LMS-03', HIGH],
  [T, 904, CSDL, 'COMB-02', CRITICAL],
  [T, 908, LOG, 'ACA-01', HIGH],
  [M, 903, TTNT, 'LMS-01', MEDIUM],
  [M, 903, TTNT, 'LMS-03', MEDIUM],
  [M, 903, TTNT, 'COMB-01', CRITICAL],
  [M, 904, GT, 'LMS-02', MEDIUM],
  [M, 905, TTNT, 'LMS-03', HIGH],
  [M, 906, TTNT, 'LMS-01', MEDIUM],
  [M, 908, TTNT, 'LMS-04', LOW],
  [D, 905, TTHCM, 'LMS-01', MEDIUM],
]);

const RUN3 = keys([
  [K, 903, HQT, 'ACA-01', HIGH],
  [K, 903, null, 'ACA-02', HIGH],
  [K, 903, null, 'ACA-03', HIGH],
  [K, 908, null, 'ACA-03', HIGH],
  [K, 913, LOG, 'ACA-01', HIGH],
  [K, 913, null, 'ACA-02', HIGH],
  [K, 914, LOG, 'ACA-01', HIGH],
  [K, 914, null, 'ACA-02', HIGH],
  [K, 915, HQT, 'ACA-01', HIGH],
  [K, 915, PTTK, 'ACA-01', HIGH],
  [K, 915, null, 'ACA-02', CRITICAL],
  [K, 915, null, 'ACA-03', CRITICAL],
  [K, 917, null, 'ACA-03', HIGH],
  [K, 918, PTTK, 'ACA-01', HIGH],
  [K, 918, null, 'ACA-02', HIGH],
  [K, 918, null, 'ACA-03', HIGH],
  [K, 919, LOG, 'ACA-01', HIGH],
  [K, 919, null, 'ACA-02', HIGH],
  [K, 919, null, 'ACA-03', HIGH],
  [T, 906, null, 'ACA-04', MEDIUM],
  [T, 907, null, 'ACA-04', MEDIUM],
  [T, 908, LOG, 'ACA-01', HIGH],
  [T, 908, HQT, 'ACA-01', HIGH],
  [T, 908, null, 'ACA-02', CRITICAL],
  [T, 908, null, 'ACA-03', CRITICAL],
  [T, 908, null, 'ACA-04', CRITICAL],
  [T, 909, PTTK, 'ACA-01', HIGH],
  [T, 909, null, 'ACA-02', HIGH],
  [T, 909, null, 'ACA-03', HIGH],
]);

/** Mức cảnh báo mong đợi sau mỗi lần chạy (bảng "Cảnh báo" của KET_QUA_MONG_DOI.md). */
type AlertRow = [V3Class, number, Severity];
const ALERTS_RUN1: AlertRow[] = [
  [K, 902, MEDIUM], [K, 903, CRITICAL], [K, 904, HIGH], [K, 905, HIGH], [K, 906, MEDIUM],
  [K, 908, HIGH], [K, 909, LOW], [K, 910, CRITICAL], [K, 911, MEDIUM], [K, 913, CRITICAL],
  [C, 903, HIGH], [C, 904, MEDIUM], [C, 905, MEDIUM], [C, 907, LOW], [C, 908, CRITICAL],
  [T, 903, HIGH], [T, 904, CRITICAL],
  [M, 903, CRITICAL], [M, 904, CRITICAL], [M, 905, MEDIUM], [M, 906, HIGH], [M, 908, MEDIUM],
  [D, 903, CRITICAL], [D, 905, MEDIUM],
]; // prettier-ignore
const ALERTS_RUN2: AlertRow[] = [
  ...ALERTS_RUN1.filter(([c, n]) => !(c === K && n === 913) && !(c === M && [905, 906].includes(n))),
  [K, 912, MEDIUM], [K, 914, HIGH], [K, 919, HIGH], [K, 913, HIGH],
  [C, 909, MEDIUM], [T, 908, HIGH], [M, 905, HIGH], [M, 906, MEDIUM],
]; // prettier-ignore
const ALERTS_RUN3: AlertRow[] = [
  ...ALERTS_RUN2.filter(([c, n]) => !(c === K && n === 903) && !(c === T && n === 908)),
  [K, 903, HIGH], [K, 915, CRITICAL], [K, 917, HIGH], [K, 918, HIGH],
  [T, 906, MEDIUM], [T, 907, MEDIUM], [T, 908, CRITICAL], [T, 909, HIGH],
]; // prettier-ignore

async function triggerKeys(runId: string): Promise<string[]> {
  const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: runId });
  return triggers.map((t) => `${t.studentId}|${t.scopeId}|${t.ruleCode}|${t.severity}`).sort();
}

async function alertLevels(): Promise<string[]> {
  const alerts = await ds.getRepository(Alert).findBy({ termId: V3.hk1 });
  return alerts.map((a) => `${a.studentId}|${a.severity}`).sort();
}
const expectedLevels = (rows: AlertRow[]) =>
  rows.map(([cls, n, s]) => `${v3sv(cls, n)}|${s}`).sort();

async function notesOf(runId: string) {
  const notes = await ds.getRepository(Notification).findBy({ evaluationRunId: runId });
  return {
    inApp: notes.filter((n) => n.channel === NotificationChannel.IN_APP).length,
    email: notes.filter((n) => n.channel === NotificationChannel.EMAIL).length,
  };
}

async function alertOf(cls: V3Class, n: number): Promise<Alert> {
  return ds.getRepository(Alert).findOneByOrFail({ studentId: v3sv(cls, n), termId: V3.hk1 });
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await setupDemoV3(ds);
}, 180_000);

afterAll(async () => {
  await cleanupDemoV3(ds);
  await closeDataSource();
});

describe('Nghiệm thu bộ demo v3 — KET_QUA_MONG_DOI.md', () => {
  it('nạp 7 lô nhiều file đúng số dòng, 0 lỗi; 1 cảnh báo sai tên ghi tên file', async () => {
    const batches = await ds
      .getRepository(ImportBatch)
      .createQueryBuilder('b')
      .where(`b.fileName LIKE 'tst-%'`)
      .orderBy('b.createdAt', 'ASC')
      .getMany();
    expect(batches.map((b) => [b.successRows, b.errorRows])).toEqual([
      [100, 0],
      [582, 0],
      [600, 0],
      [400, 0],
      [404, 0],
      [80, 0],
      [219, 0],
    ]);
    const attendance = batches[2];
    expect(attendance?.warnings).toEqual([
      expect.objectContaining({ code: 'NAME_MISMATCH', file: 'tst-010100090202_2025-10-09.csv' }),
    ]);
  });

  it('chạy 1 (10/10): đúng và đủ 41 dấu hiệu, 24 cảnh báo, thông báo 24 / 22', async () => {
    const sent: string[] = [];
    const run = await evaluate(V3.hk1, endOf('2025-10-10'), sent);
    expect(await triggerKeys(run)).toEqual(RUN1);
    expect(await alertLevels()).toEqual(expectedLevels(ALERTS_RUN1));
    expect(await notesOf(run)).toEqual({ inApp: 24, email: 22 });
    // Mỗi lớp về đúng Cố vấn học tập của lớp; luôn chỉ tham khảo.
    const advisorOf = new Map<string, string>(
      Object.values(V3_CLASSES).map((c) => [c.test, c.advisor]),
    );
    for (const a of await ds.getRepository(Alert).findBy({ termId: V3.hk1 })) {
      expect(a, a.studentId).toMatchObject({
        assignedAdvisorId: advisorOf.get(a.studentId.slice(0, 8)),
        isReferenceOnly: true,
      });
    }
  });

  it('mức đủ dữ liệu chạy 1: sạch = Đủ; chuyển đến không có học kỳ trước = Một phần; 919 = Chưa đủ', async () => {
    const runId = (
      await ds.getRepository(RiskScoreLog).findOneOrFail({
        where: { studentId: v3sv(D, 901), termId: V3.hk1 },
        order: { calculatedAt: 'ASC' },
      })
    ).evaluationRunId;
    const level = async (n: number) =>
      ds
        .getRepository(RiskScoreLog)
        .findOneByOrFail({ evaluationRunId: runId, studentId: v3sv(D, n) });
    expect((await level(901)).dataCompletenessLevel).toBe(DataCompletenessLevel.FULL);
    expect((await level(918)).dataCompletenessLevel).toBe(DataCompletenessLevel.PARTIAL);
    expect(await level(919)).toMatchObject({
      dataCompletenessLevel: DataCompletenessLevel.INSUFFICIENT,
      riskScoreValue: null,
    });
  });

  it('vòng đời KHMT 905: Cố vấn học tập giải quyết sau chạy 1 → chạy 2 dấu hiệu nặng hơn → mở lại', async () => {
    const alert = await alertOf(M, 905);
    const advisor = V3_CLASSES[M].advisor;
    await changeAlertStatus(alert.alertId, AlertStatus.ACKNOWLEDGED, advisor, null);
    await recordIntervention(
      alert.alertId,
      {
        type: InterventionType.PHONE_CALL,
        content: 'Nhắc nộp bài thực hành Trí tuệ nhân tạo.',
        outcome: null,
        status: 'DONE',
        nextFollowUpAt: null,
        confidentialityLevel: ConfidentialityLevel.NORMAL,
      },
      advisor,
    );
    await changeAlertStatus(alert.alertId, AlertStatus.RESOLVED, advisor, null);
    expect((await alertOf(M, 905)).status).toBe(AlertStatus.RESOLVED);
  });

  it('chạy 2 (20/11): 27 dấu hiệu, 29 cảnh báo, thông báo 6 / 6; KHMT 905 mở lại, 906 giảm mức không thông báo', async () => {
    const run = await evaluate(V3.hk1, endOf('2025-11-20'));
    expect(await triggerKeys(run)).toEqual(RUN2);
    expect(await alertLevels()).toEqual(expectedLevels(ALERTS_RUN2));
    expect(await notesOf(run)).toEqual({ inApp: 6, email: 6 });
    expect((await alertOf(M, 905)).status).toBe(AlertStatus.REOPENED);
    const a906 = await alertOf(M, 906);
    expect(
      await ds.getRepository(Notification).countBy({ alertId: a906.alertId, evaluationRunId: run }),
    ).toBe(0);
    // Điểm danh quá hạn ≠ hết dấu hiệu: HTTT 903 giữ ATT-01 + COMB-02 của học phần học lại.
    const t903 = await alertOf(T, 903);
    const current = await ds.getRepository(RuleTrigger).findBy({ alertId: t903.alertId });
    const currentCodes = current
      .filter((t) => t903.currentTriggerIds?.includes(t.id))
      .map((t) => t.ruleCode)
      .sort();
    expect(currentCodes).toEqual(['ATT-01', 'COMB-02']);
  });

  it('học lại do hệ thống tự đếm: HTTT 903, 904, 905 học Cơ sở dữ liệu lần 2', async () => {
    const attempts = await ds.getRepository(Enrollment).findBy({ termId: V3.hk1, courseId: CSDL });
    expect(attempts.map((e) => [e.studentId, e.attemptNumber]).sort()).toEqual([
      [v3sv(T, 903), 2],
      [v3sv(T, 904), 2],
      [v3sv(T, 905), 2],
    ]);
    // File HK3 + học lại ghi rõ mã học phần; mã tự suy từ lớp học phần (bỏ 2 số cuối) phải trùng.
    const hk3 = await ds.getRepository(Enrollment).findBy({ termId: V3.hk3 });
    expect(hk3).toHaveLength(582);
    expect(hk3.every((e) => e.sectionCode?.slice(0, -2) === e.courseId)).toBe(true);
  });

  it('rút học phần (KHDL 903 bỏ Phân tích CSDL lớn): không còn trong danh sách thiếu kết quả, không còn dấu hiệu; bỏ đánh dấu → như cũ', async () => {
    const enrollment = await ds
      .getRepository(Enrollment)
      .findOneByOrFail({ studentId: v3sv(D, 903), termId: V3.hk1, courseId: PTCSDL });
    const mark = (withdrawn: boolean) =>
      ds.transaction((em) =>
        setEnrollmentWithdrawn(
          em,
          { studentId: v3sv(D, 903), enrollmentId: enrollment.enrollmentId, withdrawn },
          IMPORT_ACTOR,
        ),
      );
    await mark(true);
    expect((await listTermMissingResults(V3.hk1)).map((m) => m.studentId)).not.toContain(
      v3sv(D, 903),
    );
    const run = await evaluate(V3.hk1, endOf('2025-11-20'));
    expect((await triggerKeys(run)).filter((k) => k.startsWith(v3sv(D, 903)))).toEqual([]);
    await mark(false);
    expect(await triggerKeys(await evaluate(V3.hk1, endOf('2025-11-20')))).toEqual(RUN2);
  });

  it('trước khi chốt: đúng 2 sinh viên thiếu kết quả', async () => {
    const missing = await listTermMissingResults(V3.hk1);
    expect(missing.map((m) => [m.studentId, m.courses.map((c) => c.courseId)])).toEqual([
      [v3sv(D, 903), [PTCSDL]],
      [v3sv(K, 919), [PTTK]],
    ]);
  });

  it('chạy 3 (chốt 31/12): 29 dấu hiệu, 35 cảnh báo, thông báo 7 / 7; học kỳ đã chốt', async () => {
    const run = await evaluate(V3.hk1, endOf('2025-12-31'), [], EvaluationTrigger.TERM_CLOSING);
    expect(await triggerKeys(run)).toEqual(RUN3);
    expect(await alertLevels()).toEqual(expectedLevels(ALERTS_RUN3));
    expect(await notesOf(run)).toEqual({ inApp: 7, email: 7 });
    const reason = async (n: number, rule: string) =>
      (
        await ds
          .getRepository(RuleTrigger)
          .findOneByOrFail({ evaluationRunId: run, studentId: v3sv(T, n), ruleCode: rule })
      ).reason;
    expect(await reason(908, 'ACA-04')).toContain('2 học kỳ liên tiếp');
    expect(await reason(907, 'ACA-04')).toContain('ĐTB giảm');
    expect(
      (await ds.getRepository(Term).findOneByOrFail({ termId: V3.hk1 })).closedAt,
    ).not.toBeNull();
  });
});
