/**
 * npm run perf:measure — đo hiệu năng trên DB `_perf` (sau `perf:seed`), in bảng Markdown cho báo
 * cáo (docs/rules/05): thời gian chạy đánh giá 1 học kỳ, thời gian các truy vấn danh sách
 * (trung vị 5 lần), EXPLAIN ANALYZE truy vấn danh sách cảnh báo.
 */
import 'dotenv/config';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { Alert } from '../src/db/entities/alert.entity';
import { AdministrativeClass } from '../src/db/entities/administrative-class.entity';
import { EvaluationRun } from '../src/db/entities/evaluation-run.entity';
import { RuleTrigger } from '../src/db/entities/rule-trigger.entity';
import { Student } from '../src/db/entities/student.entity';
import { EvaluationTrigger, OPEN_ALERT_STATUSES } from '../src/db/enums';
import { getEnv } from '../src/lib/env';
import { auditFilterSchema, listAuditLogs } from '../src/modules/admin/services/audit-log.service';
import { getSetupCounts } from '../src/modules/admin/services/getting-started.service';
import { getAdminOverview } from '../src/modules/admin/services/overview.service';
import {
  quickSearchStudents,
  searchStudents,
} from '../src/modules/admin/services/student-search.service';
import {
  getAlertDetail,
  listAdminAlerts,
  listAdvisorAlerts,
} from '../src/modules/alerts/services/alert-query.service';
import { getStudentProfile } from '../src/modules/alerts/services/student-profile.service';
import { getEvaluationFormOptions } from '../src/modules/rule-engine/services/evaluation-query.service';
import {
  processEvaluationRun,
  requestEvaluation,
} from '../src/modules/rule-engine/services/evaluation-run.service';
import { PERF } from './perf-config';

const asOf = new Date('2026-10-10T23:59:59+07:00');
const noop = () => Promise.resolve();
const ms = (start: bigint) => Number(process.hrtime.bigint() - start) / 1e6;

async function timed<T>(work: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = process.hrtime.bigint();
  const value = await work();
  return { ms: ms(start), value };
}

async function median(work: () => Promise<unknown>, times = 5): Promise<number> {
  await work(); // làm nóng
  const samples: number[] = [];
  for (let i = 0; i < times; i++) samples.push((await timed(work)).ms);
  samples.sort((a, b) => a - b);
  return samples[Math.floor(times / 2)] ?? 0;
}

async function runEvaluation(courseId: string | null) {
  let peak = 0;
  const timer = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().heapUsed);
  }, 50);
  const { ms: elapsed, value: runId } = await timed(async () => {
    const id = await requestEvaluation(
      {
        termId: PERF.currentTerm,
        courseId,
        trigger: EvaluationTrigger.MANUAL,
        asOf,
        actorId: 'ADMIN',
        importBatchId: null,
      },
      noop,
    );
    if (!id) throw new Error('không tạo được lần chạy');
    await processEvaluationRun(id, noop);
    return id;
  });
  clearInterval(timer);
  const ds = await getDataSource();
  const run = await ds.getRepository(EvaluationRun).findOneByOrFail({ id: runId });
  const triggers = await ds.getRepository(RuleTrigger).countBy({ evaluationRunId: runId });
  return { elapsed, run, triggers, peakMb: peak / 1024 / 1024 };
}

async function explain(sql: string, params: unknown[]): Promise<string> {
  const ds = await getDataSource();
  const rows: { 'QUERY PLAN': string }[] = await ds.query(
    `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
    params,
  );
  return rows.map((r) => r['QUERY PLAN']).join('\n');
}

/** Xóa kết quả đánh giá cũ của học kỳ hiệu năng (chỉ DB _perf) để lần đo "lần đầu" luôn đúng. */
async function resetEvaluations(): Promise<void> {
  const ds = await getDataSource();
  const term = [PERF.currentTerm];
  await ds.query(
    `DELETE FROM notifications WHERE alert_id IN (SELECT alert_id FROM alerts WHERE term_id = $1)`,
    term,
  );
  await ds.query(
    `DELETE FROM alert_state_history WHERE alert_id IN (SELECT alert_id FROM alerts WHERE term_id = $1)`,
    term,
  );
  await ds.query(`DELETE FROM rule_triggers WHERE term_id = $1`, term);
  await ds.query(`DELETE FROM alerts WHERE term_id = $1`, term);
  await ds.query(`DELETE FROM risk_score_logs WHERE term_id = $1`, term);
  await ds.query(`DELETE FROM evaluation_runs WHERE term_id = $1`, term);
}

async function main() {
  const dbName = new URL(getEnv().DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith('_perf')) throw new Error(`Chỉ đo trên DB _perf (đang là "${dbName}").`);
  const ds = await getDataSource();
  await resetEvaluations();
  const out: string[] = [];
  const line = (s = '') => out.push(s);

  line('## Chạy đánh giá 1 học kỳ');
  line();
  line(
    '| Lần chạy | Sinh viên | Dấu hiệu | Cảnh báo mới / cập nhật | Thời gian | Bộ nhớ heap cao nhất |',
  );
  line('|---|---|---|---|---|---|');
  for (const [label, courseId] of [
    ['Cả học kỳ — lần đầu (tạo cảnh báo)', null],
    ['Cả học kỳ — chạy lại (cập nhật)', null],
    ['Theo 1 học phần', 'PC001'],
  ] as const) {
    const r = await runEvaluation(courseId);
    line(
      `| ${label} | ${r.run.totalStudents} | ${r.triggers} | ${r.run.alertsCreated} / ${r.run.alertsUpdated} | ${(r.elapsed / 1000).toFixed(1)} giây | ${r.peakMb.toFixed(0)} MB |`,
    );
  }

  const advisor = await ds
    .getRepository(AdministrativeClass)
    .findOneByOrFail({ classId: 'P0012311' });
  const anAlert = await ds.getRepository(Alert).findOneByOrFail({ termId: PERF.currentTerm });
  const student = await ds.getRepository(Student).findOneByOrFail({ studentId: 'P000001' });
  const queries: [string, () => Promise<unknown>][] = [
    ['Danh sách cảnh báo Admin (trang 1, 20 dòng)', () => listAdminAlerts(PERF.currentTerm, 'ALL')],
    [
      'Danh sách cảnh báo Admin, lọc 1 khoa',
      () => listAdminAlerts(PERF.currentTerm, 'ALL', 'K.CNTT'),
    ],
    [
      'Cảnh báo cần xử lý của 1 Cố vấn học tập',
      () => listAdvisorAlerts(advisor.advisorId ?? '', PERF.currentTerm, 'TODO'),
    ],
    ['Chi tiết 1 cảnh báo', () => getAlertDetail(anAlert.alertId, { canProcess: true })],
    ['Hồ sơ học tập 1 sinh viên', () => getStudentProfile(student.studentId, PERF.currentTerm)],
    ['Tổng quan Admin (toàn trường)', () => getAdminOverview()],
    ['Tổng quan Admin (1 khoa)', () => getAdminOverview('K.CNTT')],
    ['Trang "Bắt đầu" (đếm dữ liệu)', () => getSetupCounts()],
    ['Form chạy đánh giá (học phần theo khoa)', () => getEvaluationFormOptions()],
    ['Tìm sinh viên (trang 1)', () => searchStudents('P0049')],
    [
      'Tìm nhanh Ctrl+K theo họ tên không dấu (Admin)',
      () => quickSearchStudents('nguyen van', null),
    ],
    [
      'Tìm nhanh Ctrl+K (Cố vấn học tập, 1 lớp)',
      () => quickSearchStudents('nguyen', advisor.advisorId ?? ''),
    ],
    ['Nhật ký hệ thống (trang 1, không lọc)', () => listAuditLogs(auditFilterSchema.parse({}))],
  ];
  line();
  line('## Truy vấn màn hình (trung vị 5 lần, sau 1 lần làm nóng)');
  line();
  line('| Màn hình / truy vấn | Thời gian |');
  line('|---|---|');
  for (const [label, work] of queries) line(`| ${label} | ${(await median(work)).toFixed(0)} ms |`);

  const adminList = ds
    .getRepository(Alert)
    .createQueryBuilder('a')
    .innerJoin(Student, 's', 's.studentId = a.studentId')
    .innerJoin(AdministrativeClass, 'c', 'c.classId = s.classId')
    .where('a.termId = :termId', { termId: PERF.currentTerm })
    .take(500)
    .getQueryAndParameters();
  const advisorList = ds
    .getRepository(Alert)
    .createQueryBuilder('a')
    .innerJoin(Student, 's', 's.studentId = a.studentId')
    .innerJoin(AdministrativeClass, 'c', 'c.classId = s.classId')
    .where('c.advisorId = :advisorId', { advisorId: advisor.advisorId })
    .andWhere('a.termId = :termId', { termId: PERF.currentTerm })
    .andWhere('a.status IN (:...open)', { open: OPEN_ALERT_STATUSES })
    .take(500)
    .getQueryAndParameters();
  line();
  line('## EXPLAIN ANALYZE — danh sách cảnh báo của 1 Cố vấn học tập');
  line();
  line('```');
  line(await explain(...advisorList));
  line('```');
  line();
  line('## EXPLAIN ANALYZE — danh sách cảnh báo Admin');
  line();
  line('```');
  line(await explain(...adminList));
  line('```');
  process.stdout.write(`${out.join('\n')}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `perf:measure lỗi: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(() => void closeDataSource());
