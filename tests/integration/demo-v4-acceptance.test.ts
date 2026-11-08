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
  cleanupDemoV4,
  setupDemoV4,
  stageSample,
  V4,
  V4_CLASSES,
  type V4Class,
  v4course,
  v4sv,
} from '../helpers/demo-v4';
import { IMPORT_ACTOR, useMemoryStorage } from '../helpers/import-helpers';

/**
 * Nghiệm thu bộ demo v4 (docs/rules/02): nhập TOÀN BỘ docs/demo-data (bản sao mã TST) theo
 * KET_QUA_MONG_DOI.md, chạy 3 mốc, so khớp ĐÚNG và ĐỦ dấu hiệu của 110 sinh viên (thừa / thiếu đều
 * lỗi), cảnh báo, thông báo, mức đủ dữ liệu, vòng đời KHMT, rút học phần KHDL.
 */
let ds: DataSource;
const { LOW, MEDIUM, HIGH, CRITICAL } = Severity;

// Học phần (mã thật → mã thử).
const LOG = v4course('0101002408');
const HQT = v4course('0101000900');
const PTTK = v4course('0101000902');
const KTMT = v4course('0101000890');
const MANG = v4course('0101000892');
const CSDL = v4course('0101000894');
const GT = v4course('0101002318');
const TTNT = v4course('0101000896');
const XSTK = v4course('0101000773');
const TTHCM = v4course('0101002336');
const PTCSDL = v4course('0101002299');
const TOAN = v4course('0101000889');
const NNLT1 = v4course('0101002394');

type Row = [V4Class, number, string | null, string, Severity];
const key = ([cls, n, scope, rule, severity]: Row) =>
  `${v4sv(cls, n)}|${scope ?? v4sv(cls, n)}|${rule}|${severity}`;
const keys = (rows: Row[]) => rows.map(key).sort();

const K = 'KTPM2411' as const;
const C = 'CNTT2411' as const;
const T = 'HTTT2411' as const;
const M = 'KHMT2411' as const;
const D = 'KHDL2411' as const;
const N = 'KTPM2511' as const;

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
  [K, 920, PTTK, 'ATT-01', MEDIUM],
  [C, 903, KTMT, 'LMS-01', HIGH],
  [C, 903, MANG, 'LMS-03', HIGH],
  [C, 904, LOG, 'LMS-01', MEDIUM],
  [C, 905, KTMT, 'LMS-02', MEDIUM],
  [C, 907, MANG, 'LMS-04', LOW],
  [C, 908, KTMT, 'LMS-01', MEDIUM],
  [C, 908, KTMT, 'LMS-03', MEDIUM],
  [C, 908, KTMT, 'COMB-01', CRITICAL],
  [C, 913, KTMT, 'LMS-01', MEDIUM],
  [C, 914, KTMT, 'LMS-01', MEDIUM],
  [T, 903, CSDL, 'ATT-01', MEDIUM],
  [T, 903, CSDL, 'COMB-02', HIGH],
  [T, 904, CSDL, 'LMS-03', HIGH],
  [T, 904, CSDL, 'COMB-02', CRITICAL],
  [T, 911, CSDL, 'ATT-01', HIGH],
  [T, 911, CSDL, 'COMB-02', CRITICAL],
  [T, 912, CSDL, 'ATT-01', CRITICAL],
  [T, 912, CSDL, 'COMB-02', CRITICAL],
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
  [M, 910, TTNT, 'LMS-03', MEDIUM],
  [D, 903, PTCSDL, 'ATT-01', CRITICAL],
  [D, 905, TTHCM, 'LMS-01', MEDIUM],
  [N, 905, NNLT1, 'ATT-01', MEDIUM],
  [N, 906, TOAN, 'ATT-01', HIGH],
  [N, 906, TOAN, 'ATT-02', HIGH],
]);

const RUN2 = keys([
  [K, 903, HQT, 'ATT-01', CRITICAL],
  [K, 904, HQT, 'ATT-01', HIGH],
  [K, 908, HQT, 'LMS-03', HIGH],
  [K, 909, HQT, 'LMS-04', LOW],
  [K, 910, PTTK, 'ATT-01', MEDIUM],
  [K, 910, PTTK, 'LMS-03', MEDIUM],
  [K, 910, PTTK, 'COMB-01', CRITICAL],
  [K, 911, PTTK, 'ATT-01', HIGH],
  [K, 911, PTTK, 'LMS-04', LOW],
  [K, 912, HQT, 'LMS-03', MEDIUM],
  [K, 913, LOG, 'ACA-01', HIGH],
  [K, 914, LOG, 'ACA-01', HIGH],
  [K, 919, LOG, 'ACA-01', HIGH],
  [K, 920, PTTK, 'ATT-01', MEDIUM],
  [C, 903, KTMT, 'LMS-01', HIGH],
  [C, 903, MANG, 'LMS-03', HIGH],
  [C, 905, KTMT, 'LMS-02', MEDIUM],
  [C, 907, MANG, 'LMS-04', LOW],
  [C, 908, KTMT, 'LMS-01', MEDIUM],
  [C, 908, KTMT, 'LMS-03', MEDIUM],
  [C, 908, KTMT, 'COMB-01', CRITICAL],
  [C, 909, MANG, 'LMS-03', MEDIUM],
  [C, 910, MANG, 'LMS-03', MEDIUM],
  [C, 913, KTMT, 'LMS-01', MEDIUM],
  [T, 904, CSDL, 'LMS-03', HIGH],
  [T, 904, CSDL, 'COMB-02', CRITICAL],
  [T, 908, LOG, 'ACA-01', HIGH],
  [M, 903, TTNT, 'ATT-01', MEDIUM],
  [M, 903, TTNT, 'LMS-01', MEDIUM],
  [M, 903, TTNT, 'LMS-03', MEDIUM],
  [M, 903, TTNT, 'COMB-01', CRITICAL],
  [M, 904, GT, 'ATT-01', HIGH],
  [M, 904, GT, 'LMS-02', MEDIUM],
  [M, 904, GT, 'COMB-01', CRITICAL],
  [M, 905, TTNT, 'LMS-03', HIGH],
  [M, 906, TTNT, 'LMS-01', MEDIUM],
  [M, 908, TTNT, 'ATT-01', MEDIUM],
  [M, 908, TTNT, 'LMS-04', LOW],
  [M, 910, TTNT, 'LMS-03', MEDIUM],
  [M, 912, GT, 'LMS-01', MEDIUM],
  [M, 913, LOG, 'ACA-01', HIGH],
  [D, 905, TTHCM, 'LMS-01', MEDIUM],
  [N, 905, NNLT1, 'ATT-01', MEDIUM],
  [N, 906, TOAN, 'ATT-01', CRITICAL],
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
  [T, 913, null, 'ACA-03', HIGH],
  [M, 913, LOG, 'ACA-01', HIGH],
  [M, 913, null, 'ACA-02', HIGH],
  [M, 913, null, 'ACA-03', HIGH],
  [N, 902, NNLT1, 'ACA-01', HIGH],
  [N, 902, null, 'ACA-02', HIGH],
  [N, 902, null, 'ACA-03', HIGH],
  [N, 903, NNLT1, 'ACA-01', HIGH],
  [N, 903, null, 'ACA-02', HIGH],
  [N, 903, null, 'ACA-03', CRITICAL],
  [N, 904, TOAN, 'ACA-01', HIGH],
  [N, 904, null, 'ACA-02', CRITICAL],
  [N, 904, null, 'ACA-03', HIGH],
]);

/** Mức cảnh báo mong đợi sau mỗi lần chạy (bảng "Cảnh báo" của KET_QUA_MONG_DOI.md). */
type AlertRow = [V4Class, number, Severity];
const replaceLevels = (rows: AlertRow[], changes: AlertRow[]): AlertRow[] => [
  ...rows.filter(([c, n]) => !changes.some(([c2, n2]) => c === c2 && n === n2)),
  ...changes,
];

const ALERTS_RUN1: AlertRow[] = [
  [K, 902, MEDIUM], [K, 903, CRITICAL], [K, 904, HIGH], [K, 905, HIGH], [K, 906, MEDIUM],
  [K, 908, HIGH], [K, 909, LOW], [K, 910, CRITICAL], [K, 911, MEDIUM], [K, 913, CRITICAL],
  [K, 920, MEDIUM],
  [C, 903, HIGH], [C, 904, MEDIUM], [C, 905, MEDIUM], [C, 907, LOW], [C, 908, CRITICAL],
  [C, 913, MEDIUM], [C, 914, MEDIUM],
  [T, 903, HIGH], [T, 904, CRITICAL], [T, 911, CRITICAL], [T, 912, CRITICAL],
  [M, 903, CRITICAL], [M, 904, CRITICAL], [M, 905, MEDIUM], [M, 906, HIGH], [M, 908, MEDIUM],
  [M, 910, MEDIUM],
  [D, 903, CRITICAL], [D, 905, MEDIUM],
  [N, 905, MEDIUM], [N, 906, HIGH],
]; // prettier-ignore
const ALERTS_RUN2 = replaceLevels(ALERTS_RUN1, [
  [K, 912, MEDIUM], [K, 914, HIGH], [K, 919, HIGH], [K, 911, HIGH], [K, 913, HIGH],
  [C, 909, MEDIUM], [C, 910, MEDIUM], [T, 908, HIGH],
  [M, 912, MEDIUM], [M, 913, HIGH], [M, 905, HIGH], [M, 906, MEDIUM],
  [N, 906, CRITICAL],
]); // prettier-ignore
const ALERTS_RUN3 = replaceLevels(ALERTS_RUN2, [
  [K, 915, CRITICAL], [K, 917, HIGH], [K, 918, HIGH], [K, 903, HIGH],
  [T, 906, MEDIUM], [T, 907, MEDIUM], [T, 909, HIGH], [T, 913, HIGH], [T, 908, CRITICAL],
  [N, 902, HIGH], [N, 903, CRITICAL], [N, 904, CRITICAL],
]); // prettier-ignore

async function triggerKeys(runId: string): Promise<string[]> {
  const triggers = await ds.getRepository(RuleTrigger).findBy({ evaluationRunId: runId });
  return triggers.map((t) => `${t.studentId}|${t.scopeId}|${t.ruleCode}|${t.severity}`).sort();
}

async function alertLevels(): Promise<string[]> {
  const alerts = await ds.getRepository(Alert).findBy({ termId: V4.hk1 });
  return alerts.map((a) => `${a.studentId}|${a.severity}`).sort();
}
const expectedLevels = (rows: AlertRow[]) =>
  rows.map(([cls, n, s]) => `${v4sv(cls, n)}|${s}`).sort();

async function notesOf(runId: string) {
  const notes = await ds.getRepository(Notification).findBy({ evaluationRunId: runId });
  return {
    inApp: notes.filter((n) => n.channel === NotificationChannel.IN_APP).length,
    email: notes.filter((n) => n.channel === NotificationChannel.EMAIL).length,
  };
}

async function alertOf(cls: V4Class, n: number): Promise<Alert> {
  const alerts = await ds.getRepository(Alert).find({
    where: { studentId: v4sv(cls, n), termId: V4.hk1 },
    order: { firstDetectedAt: 'ASC' },
  });
  const first = alerts[0];
  if (!first) throw new Error(`Không có cảnh báo của ${cls} ${n}`);
  return first;
}

async function statusesOf(cls: V4Class, n: number): Promise<AlertStatus[]> {
  const alerts = await ds.getRepository(Alert).find({
    where: { studentId: v4sv(cls, n), termId: V4.hk1 },
    order: { firstDetectedAt: 'ASC' },
  });
  return alerts.map((a) => a.status);
}

const intervention = (status: 'DONE' | 'FOLLOW_UP') => ({
  type: InterventionType.PHONE_CALL,
  content: 'Trao đổi với sinh viên về tình hình học tập.',
  outcome: null,
  status,
  nextFollowUpAt: null,
  confidentialityLevel: ConfidentialityLevel.NORMAL,
});

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await setupDemoV4(ds);
}, 300_000);

afterAll(async () => {
  await cleanupDemoV4(ds);
  await closeDataSource();
});

describe('Nghiệm thu bộ demo v4: KET_QUA_MONG_DOI.md', () => {
  it('nhập 9 đợt nhiều file đúng số dòng, 0 lỗi; 1 cảnh báo sai tên ghi tên file', async () => {
    const batches = await ds
      .getRepository(ImportBatch)
      .createQueryBuilder('b')
      .where(`b.fileName LIKE 'tst-%'`)
      .orderBy('b.createdAt', 'ASC')
      .getMany();
    expect(batches.map((b) => [b.successRows, b.errorRows])).toEqual([
      [110, 0],
      [1, 0],
      [582, 0],
      [626, 0],
      [525, 0],
      [491, 0],
      [402, 0],
      [80, 0],
      [231, 0],
    ]);
    expect(batches[4]?.warnings).toEqual([
      expect.objectContaining({ code: 'NAME_MISMATCH', file: 'tst-010100090202_2025-10-09.csv' }),
    ]);
  });

  it('chạy 1 (10/10): đúng và đủ 52 dấu hiệu, 32 cảnh báo, thông báo 32 / 30', async () => {
    const sent: string[] = [];
    const run = await evaluate(V4.hk1, endOf('2025-10-10'), sent);
    expect(await triggerKeys(run)).toEqual(RUN1);
    expect(await alertLevels()).toEqual(expectedLevels(ALERTS_RUN1));
    expect(await notesOf(run)).toEqual({ inApp: 32, email: 30 });
    const advisorOf = new Map<string, string>(
      Object.values(V4_CLASSES).map((c) => [c.test, c.advisor]),
    );
    for (const a of await ds.getRepository(Alert).findBy({ termId: V4.hk1 })) {
      expect(a, a.studentId).toMatchObject({
        assignedAdvisorId: advisorOf.get(a.studentId.slice(0, 8)),
        isReferenceOnly: true,
      });
    }
  });

  it('mức đủ dữ liệu chạy 1: Đủ / Một phần / Chưa đủ; năm nhất chưa có học lực = Một phần', async () => {
    const runId = (
      await ds.getRepository(RiskScoreLog).findOneOrFail({
        where: { studentId: v4sv(D, 901), termId: V4.hk1 },
        order: { calculatedAt: 'ASC' },
      })
    ).evaluationRunId;
    const level = async (cls: V4Class, n: number) =>
      ds
        .getRepository(RiskScoreLog)
        .findOneByOrFail({ evaluationRunId: runId, studentId: v4sv(cls, n) });
    expect((await level(D, 901)).dataCompletenessLevel).toBe(DataCompletenessLevel.FULL);
    expect((await level(D, 918)).dataCompletenessLevel).toBe(DataCompletenessLevel.PARTIAL);
    expect((await level(N, 901)).dataCompletenessLevel).toBe(DataCompletenessLevel.PARTIAL);
    expect(await level(D, 919)).toMatchObject({
      dataCompletenessLevel: DataCompletenessLevel.INSUFFICIENT,
      riskScoreValue: null,
    });
  });

  it('sinh viên bảo lưu, đình chỉ, buộc thôi học: không có dữ liệu học kỳ, không được đánh giá', async () => {
    const logs = await ds.getRepository(RiskScoreLog).find({
      where: [915, 916, 917].map((n) => ({ studentId: v4sv(D, n), termId: V4.hk1 })),
    });
    expect(logs).toEqual([]);
  });

  it('vòng đời KHMT: Cố vấn học tập thao tác sau chạy 1', async () => {
    const advisor = V4_CLASSES[M].advisor;
    const a903 = await alertOf(M, 903);
    await changeAlertStatus(a903.alertId, AlertStatus.ACKNOWLEDGED, advisor, null);
    await recordIntervention(a903.alertId, intervention('FOLLOW_UP'), advisor);
    expect(await statusesOf(M, 903)).toEqual([AlertStatus.IN_PROGRESS]);

    await changeAlertStatus(
      (await alertOf(M, 904)).alertId,
      AlertStatus.ACKNOWLEDGED,
      advisor,
      null,
    );
    expect(await statusesOf(M, 904)).toEqual([AlertStatus.ACKNOWLEDGED]);

    const a905 = await alertOf(M, 905);
    await changeAlertStatus(a905.alertId, AlertStatus.ACKNOWLEDGED, advisor, null);
    await recordIntervention(a905.alertId, intervention('DONE'), advisor);
    await changeAlertStatus(a905.alertId, AlertStatus.RESOLVED, advisor, null);
    expect(await statusesOf(M, 905)).toEqual([AlertStatus.RESOLVED]);

    await changeAlertStatus(
      (await alertOf(M, 908)).alertId,
      AlertStatus.DISMISSED,
      advisor,
      'Sinh viên đã có giấy xác nhận.',
    );
    await changeAlertStatus(
      (await alertOf(M, 910)).alertId,
      AlertStatus.INVALIDATED,
      advisor,
      'Giảng viên nhập nhầm bài.',
    );
  });

  it('chạy 2 (20/11): 44 dấu hiệu, thông báo 12 / 12, đủ các trạng thái sau thao tác', async () => {
    const run = await evaluate(V4.hk1, endOf('2025-11-20'));
    expect(await triggerKeys(run)).toEqual(RUN2);
    // 910: cảnh báo cũ "Không còn hiệu lực" + cảnh báo mới; còn lại mỗi sinh viên 1 cảnh báo.
    expect(await alertLevels()).toEqual(expectedLevels([...ALERTS_RUN2, [M, 910, MEDIUM]]));
    expect(await notesOf(run)).toEqual({ inApp: 12, email: 12 });

    expect(await statusesOf(M, 903)).toEqual([AlertStatus.IN_PROGRESS]);
    expect(await statusesOf(M, 904)).toEqual([AlertStatus.ACKNOWLEDGED]);
    expect(await statusesOf(M, 905)).toEqual([AlertStatus.REOPENED]);
    expect(await statusesOf(M, 906)).toEqual([AlertStatus.OPEN]);
    expect(await statusesOf(M, 908)).toEqual([AlertStatus.DISMISSED]);
    expect(await statusesOf(M, 910)).toEqual([AlertStatus.INVALIDATED, AlertStatus.OPEN]);

    const a906 = await alertOf(M, 906);
    expect(
      await ds.getRepository(Notification).countBy({ alertId: a906.alertId, evaluationRunId: run }),
    ).toBe(0);

    // Điểm danh quá hạn ≠ hết dấu hiệu: giữ ATT-01 + COMB-02 của học phần học lại.
    for (const n of [903, 911, 912]) {
      const alert = await alertOf(T, n);
      const current = await ds.getRepository(RuleTrigger).findBy({ alertId: alert.alertId });
      const codes = current
        .filter((t) => alert.currentTriggerIds?.includes(t.id))
        .map((t) => t.ruleCode)
        .sort();
      expect(codes, `HTTT ${n}`).toEqual(['ATT-01', 'COMB-02']);
    }
  });

  it('lần học do hệ thống tự đếm: HTTT 911 lần 3, các bạn còn lại lần 2', async () => {
    const attempts = await ds.getRepository(Enrollment).findBy({ termId: V4.hk1, courseId: CSDL });
    expect(attempts.map((e) => [e.studentId, e.attemptNumber]).sort()).toEqual([
      [v4sv(T, 903), 2],
      [v4sv(T, 904), 2],
      [v4sv(T, 905), 2],
      [v4sv(T, 911), 3],
      [v4sv(T, 912), 2],
    ]);
    const hk3 = await ds.getRepository(Enrollment).findBy({ termId: V4.hk3 });
    expect(hk3).toHaveLength(582);
    expect(hk3.every((e) => e.sectionCode?.slice(0, -2) === e.courseId)).toBe(true);
  });

  it('học phần không dùng LMS và lý do học lại lần 3 ghi đúng', async () => {
    const lms: unknown = await ds.query(
      `SELECT COUNT(*)::int AS n FROM lms_activities WHERE course_id = $1`,
      [XSTK],
    );
    expect(lms).toEqual([{ n: 0 }]);
    const alert = await alertOf(T, 911);
    const triggers = await ds
      .getRepository(RuleTrigger)
      .findBy({ alertId: alert.alertId, ruleCode: 'COMB-02' });
    expect(triggers[0]?.reason).toContain('lần 3');
  });

  it('rút học phần (KHDL 903 bỏ PTCSDL): hết thiếu kết quả, hết dấu hiệu; bỏ đánh dấu thì như cũ', async () => {
    const enrollment = await ds
      .getRepository(Enrollment)
      .findOneByOrFail({ studentId: v4sv(D, 903), termId: V4.hk1, courseId: PTCSDL });
    const mark = (withdrawn: boolean) =>
      ds.transaction((em) =>
        setEnrollmentWithdrawn(
          em,
          { studentId: v4sv(D, 903), enrollmentId: enrollment.enrollmentId, withdrawn },
          IMPORT_ACTOR,
        ),
      );
    await mark(true);
    expect((await listTermMissingResults(V4.hk1)).map((m) => m.studentId)).not.toContain(
      v4sv(D, 903),
    );
    const run = await evaluate(V4.hk1, endOf('2025-11-20'));
    expect((await triggerKeys(run)).filter((k) => k.startsWith(v4sv(D, 903)))).toEqual([]);
    await mark(false);
    expect(await triggerKeys(await evaluate(V4.hk1, endOf('2025-11-20')))).toEqual(RUN2);
  });

  it('trước khi chốt: đúng 3 sinh viên thiếu kết quả', async () => {
    const missing = await listTermMissingResults(V4.hk1);
    expect(missing.map((m) => [m.studentId, m.courses.map((c) => c.courseId)]).sort()).toEqual(
      [
        [v4sv(D, 903), [PTCSDL]],
        [v4sv(K, 919), [PTTK]],
        [v4sv(M, 913), [TTNT]],
      ].sort(),
    );
  });

  it.each([
    ['01_sinh_vien_sai_lop.csv', 'STUDENT', null, ['CLASS_NOT_FOUND'], []],
    ['02_diem_danh_sai_ngay_va_ma_sv.csv', 'ATTENDANCE_SUMMARY', V4.hk1, ['INVALID_FORMAT', 'STUDENT_NOT_FOUND'], []],
    ['03_diem_danh_trung_dong.csv', 'ATTENDANCE_SUMMARY', V4.hk1, ['DUPLICATE'], []],
    ['04_diem_danh_vuot_so_tiet.csv', 'ATTENDANCE_SUMMARY', V4.hk1, ['OUT_OF_RANGE'], []],
    ['05_diem_danh_sai_ngoai_hoc_ky.csv', 'ATTENDANCE_SUMMARY', V4.hk1, ['TERM_MISMATCH'], []],
    ['07_diem_danh_lech_ty_le.csv', 'ATTENDANCE_SUMMARY', V4.hk1, [], ['ABSENCE_RATE_MISMATCH']],
  ] as const)('file minh họa %s báo đúng loại lỗi', async (file, type, term, reasons, warnings) => {
    const result = await stageSample(ds, file, type, term);
    expect(result).toEqual({ reasons: [...reasons], warnings: [...warnings] });
  }); // prettier-ignore

  it('file minh họa sai học phần: chọn Logic học mà file của học phần khác', async () => {
    const result = await stageSample(
      ds,
      '06_diem_danh_sai_hoc_phan.csv',
      'ATTENDANCE_SUMMARY',
      V4.hk1,
      LOG,
    );
    expect(new Set(result.reasons)).toEqual(new Set(['COURSE_MISMATCH']));
  });

  it('chạy 3 (chốt 31/12): 42 dấu hiệu, thông báo 11 / 11; đúng các ngưỡng biên', async () => {
    const run = await evaluate(V4.hk1, endOf('2025-12-31'), [], EvaluationTrigger.TERM_CLOSING);
    expect(await triggerKeys(run)).toEqual(RUN3);
    expect(await alertLevels()).toEqual(expectedLevels([...ALERTS_RUN3, [M, 910, MEDIUM]]));
    expect(await notesOf(run)).toEqual({ inApp: 11, email: 11 });
    const reason = async (cls: V4Class, n: number, rule: string) =>
      (
        await ds
          .getRepository(RuleTrigger)
          .findOneByOrFail({ evaluationRunId: run, studentId: v4sv(cls, n), ruleCode: rule })
      ).reason;
    expect(await reason(T, 908, 'ACA-04')).toContain('2 học kỳ liên tiếp');
    expect(await reason(T, 907, 'ACA-04')).toContain('ĐTB giảm');
    expect(await reason(M, 913, 'ACA-02')).toContain('Còn 1 học phần');
    expect(await reason(N, 903, 'ACA-03')).toContain('học kỳ đầu khóa');
    expect(
      (await ds.getRepository(Term).findOneByOrFail({ termId: V4.hk1 })).closedAt,
    ).not.toBeNull();
  });
});
