import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { In, Not, type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Notification } from '@/db/entities/notification.entity';
import { RiskScoreLog } from '@/db/entities/risk-score-log.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import {
  AlertStatus,
  ConfidentialityLevel,
  InterventionType,
  NotificationChannel,
} from '@/db/enums';
import { setEnrollmentWithdrawn } from '@/modules/admin/services/enrollment.service';
import {
  changeAlertStatus,
  recordIntervention,
} from '@/modules/alerts/services/alert-lifecycle.service';
import { rollbackImportBatch } from '@/modules/data-import/services/import-batch.service';
import {
  processEvaluationRun,
  requestAutoEvaluation,
} from '@/modules/rule-engine/services/evaluation-run.service';
import { cleanupDemo, DEMO, endOf, evaluate, setupDemo } from '../helpers/demo-setup';
import {
  confirmAndLoad,
  csvToXlsx,
  IMPORT_ACTOR,
  noEnqueue,
  uploadAndValidate,
  useMemoryStorage,
} from '../helpers/import-helpers';

/**
 * Nghiệm thu các kịch bản demo nhỏ (docs/demo-data/kich-ban/NN-ten/scenario.json — người dùng
 * chốt 2026-10-15): nạp ĐÚNG file của kịch bản (đổi mã sang mã thử TST), chạy đánh giá theo mốc
 * ghi trong file, so khớp ĐÚNG và ĐỦ dấu hiệu, cảnh báo, cảnh báo dữ liệu, mức đủ dữ liệu.
 * Chạy chồng lên bộ demo chính — giống cách trình bày trước hội đồng.
 */
const ROOT = path.resolve('docs/demo-data/kich-ban');

interface ScenarioFile {
  file: string;
  dataType: string;
  termId: string | null;
  wave?: number;
  asXlsx?: boolean;
  expectErrors?: Record<string, number>;
}
interface ScenarioEvaluation {
  termId: string;
  asOf: string;
  afterWave?: number;
  triggers: string[];
  alerts: [string, string][];
  warnings?: string[];
  riskLevels?: Record<string, string>;
}
interface Scenario {
  id: string;
  title: string;
  students: string[];
  files: ScenarioFile[];
  evaluations: ScenarioEvaluation[];
  withdraw?: { student: string; courseId: string; termId: string; asOf: string };
}

/** Mã demo → mã thử (giống `demoAcademicCsv`): KTPM2311… → TSTK2311…, KTPMnnn → TSTCnnn. */
const toTest = (text: string) =>
  text
    .replace(/KTPM2311/g, 'TSTK2311')
    .replace(/KHMT2311/g, 'TSTH2311')
    .replace(/ktpm2311/g, 'tstk2311')
    .replace(/khmt2311/g, 'tsth2311')
    .replace(/KTPM(\d{3})(?!\d)/g, 'TSTC$1');
const TERMS: Record<string, string> = { HK1_2026: DEMO.hk1, HK2_2025: DEMO.hk2 };
const term = (id: string) => TERMS[id] ?? id;

const scenarios: { dir: string; s: Scenario }[] = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .map((dir) => ({
    dir,
    s: JSON.parse(readFileSync(path.join(ROOT, dir, 'scenario.json'), 'utf8')) as Scenario,
  }));

let ds: DataSource;
const batchIds = new Map<string, string>();

async function loadFile(dir: string, s: Scenario, f: ScenarioFile): Promise<void> {
  const csv = toTest(readFileSync(path.join(ROOT, dir, f.file), 'utf8'));
  const content = f.asXlsx ? await csvToXlsx(csv) : csv;
  const name = `tst-kb${s.id}-${f.file.replace(/\.csv$/, f.asXlsx ? '.xlsx' : '.csv')}`;
  const staged = await uploadAndValidate(ds, name, content, f.dataType, f.termId && term(f.termId));
  const rows = await ds.getRepository(ImportErrorRow).findBy({ importBatchId: staged.id });
  const reasons: Record<string, number> = {};
  for (const r of rows) reasons[r.errorReason] = (reasons[r.errorReason] ?? 0) + 1;
  expect(reasons, `${dir}/${f.file}: lý do lỗi`).toEqual(f.expectErrors ?? {});
  const loaded = await confirmAndLoad(ds, staged.id);
  expect(loaded.status, `${dir}/${f.file}`).toBe('RECONCILED');
  batchIds.set(`${s.id}/${f.file}`, staged.id);
}

async function checkEvaluation(s: Scenario, e: ScenarioEvaluation): Promise<string> {
  const termId = term(e.termId);
  const students = s.students.map(toTest);
  const runId = await evaluate(termId, endOf(e.asOf));
  const triggers = await ds
    .getRepository(RuleTrigger)
    .findBy({ evaluationRunId: runId, studentId: In(students) });
  const label = `KB${s.id} ${e.termId} mốc ${e.asOf}`;
  expect(
    triggers.map((t) => `${t.studentId}|${t.scopeId}|${t.ruleCode}|${t.severity}`).sort(),
    `${label}: dấu hiệu`,
  ).toEqual(e.triggers.map(toTest).sort());

  const alerts = await ds.getRepository(Alert).findBy({
    termId,
    studentId: In(students),
    status: Not(AlertStatus.INVALIDATED),
  });
  expect(alerts.map((a) => `${a.studentId}|${a.severity}`).sort(), `${label}: cảnh báo`).toEqual(
    e.alerts.map(([st, sev]) => `${toTest(st)}|${sev}`).sort(),
  );

  const run = await ds.getRepository(EvaluationRun).findOneByOrFail({ id: runId });
  const warnings = (run.dataWarnings ?? [])
    .filter((w) => w.studentId && students.includes(w.studentId))
    .map((w) => `${w.studentId}|${w.code}`);
  expect(warnings.sort(), `${label}: cảnh báo dữ liệu`).toEqual(
    (e.warnings ?? []).map(toTest).sort(),
  );
  for (const [student, level] of Object.entries(e.riskLevels ?? {})) {
    const log = await ds
      .getRepository(RiskScoreLog)
      .findOneByOrFail({ evaluationRunId: runId, studentId: toTest(student) });
    expect(log.dataCompletenessLevel, `${label}: mức dữ liệu ${student}`).toBe(level);
  }
  return runId;
}

/** KB08: Cố vấn học tập xử lý xong cảnh báo đợt 1 trước khi có dữ liệu đợt 2. */
async function resolveAlert(studentId: string, termId: string): Promise<void> {
  const alert = await ds.getRepository(Alert).findOneByOrFail({ studentId, termId });
  await changeAlertStatus(alert.alertId, AlertStatus.ACKNOWLEDGED, DEMO.advisorA, null);
  await recordIntervention(
    alert.alertId,
    {
      type: InterventionType.PHONE_CALL,
      content: 'Đã gọi điện, sinh viên hứa đi học đầy đủ.',
      outcome: null,
      status: 'DONE',
      nextFollowUpAt: null,
      confidentialityLevel: ConfidentialityLevel.NORMAL,
    },
    DEMO.advisorA,
  );
  await changeAlertStatus(alert.alertId, AlertStatus.RESOLVED, DEMO.advisorA, null);
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await setupDemo(ds);
}, 120_000);

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe.each(scenarios)('Kịch bản $dir', ({ dir, s }) => {
  it(
    s.title,
    async () => {
      const waves = [...new Set(s.files.map((f) => f.wave ?? 1))].sort();
      for (const wave of waves) {
        for (const f of s.files.filter((x) => (x.wave ?? 1) === wave)) await loadFile(dir, s, f);
        for (const e of s.evaluations.filter((x) => (x.afterWave ?? 1) === wave)) {
          await checkEvaluation(s, e);
        }
        if (s.id === '08' && wave === 1) await resolveAlert(toTest(s.students[0] ?? ''), DEMO.hk1);
      }

      if (s.withdraw) {
        const w = s.withdraw;
        const enrollment = await ds.getRepository(Enrollment).findOneByOrFail({
          studentId: toTest(w.student),
          courseId: toTest(w.courseId),
          termId: term(w.termId),
        });
        await ds.transaction((em) =>
          setEnrollmentWithdrawn(
            em,
            {
              studentId: enrollment.studentId,
              enrollmentId: enrollment.enrollmentId,
              withdrawn: true,
            },
            IMPORT_ACTOR,
          ),
        );
        await evaluate(term(w.termId), endOf(w.asOf));
        const alert = await ds
          .getRepository(Alert)
          .findOneByOrFail({ studentId: enrollment.studentId, termId: term(w.termId) });
        expect(alert.signalsClearedAt, 'rút học phần → "không còn dấu hiệu"').not.toBeNull();
      }

      if (s.id === '08') {
        const [first, second, third] = s.students.map(toTest);
        const reopened = await ds
          .getRepository(Alert)
          .findOneByOrFail({ studentId: first, termId: DEMO.hk1 });
        expect(reopened.status, 'đã giải quyết + nặng hơn → mở lại').toBe(AlertStatus.REOPENED);
        const low = await ds
          .getRepository(Alert)
          .findOneByOrFail({ studentId: second, termId: DEMO.hk1 });
        const channels = await ds.getRepository(Notification).findBy({ alertId: low.alertId });
        expect(
          channels.map((n) => n.channel),
          'mức Thấp chỉ thông báo trong ứng dụng, 1 lần',
        ).toEqual([NotificationChannel.IN_APP]);

        // Hoàn tác đợt 2 → sinh viên chỉ có dữ liệu đợt 2 không còn dấu hiệu → "không còn hiệu lực".
        let rollbackRun: string | null = null;
        await rollbackImportBatch(
          batchIds.get('08/03_diem_danh_dot2.csv') ?? '',
          IMPORT_ACTOR,
          async (b) => {
            rollbackRun = await requestAutoEvaluation(b, noEnqueue);
          },
        );
        await processEvaluationRun(rollbackRun ?? '', noEnqueue);
        const invalid = await ds
          .getRepository(Alert)
          .findOneByOrFail({ studentId: third, termId: DEMO.hk1 });
        expect(invalid.status).toBe(AlertStatus.INVALIDATED);
      }
    },
    120_000,
  );
});
