import { In } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Department } from '@/db/entities/department.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { Rule } from '@/db/entities/rule.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import {
  type DataCompletenessLevel,
  type EvaluationRunStatus,
  type EvaluationTrigger,
  type Severity,
  SEVERITY_ORDER,
} from '@/db/enums';
import { getEnv } from '@/lib/env';
import {
  findOrder,
  firstPage,
  type ListParams,
  type Paged,
  pageOffset,
  resolveSort,
} from '@/lib/list-params';

export const RUN_SORT_KEYS = ['createdAt', 'asOf', 'status'] as const;
export type RunSortKey = (typeof RUN_SORT_KEYS)[number];
export const RUN_DEFAULT_SORT = { sort: 'createdAt', dir: 'desc' } as const;

export interface EvaluationRunListItemDto {
  id: string;
  termId: string;
  termName: string;
  courseId: string | null;
  trigger: EvaluationTrigger;
  asOf: string;
  status: EvaluationRunStatus;
  totalStudents: number;
  processedStudents: number;
  triggerCount: number;
  insufficientCount: number;
  alertsCreated: number;
  alertsUpdated: number;
  triggeredBy: string | null;
  createdAt: string;
}

export interface EvaluationRunDetailDto extends EvaluationRunListItemDto {
  errorMessage: string | null;
  importBatchId: string | null;
  finishedAt: string | null;
  warnings: { code: string; studentId: string | null; courseId: string | null; message: string }[];
  /** Số cảnh báo chất lượng dữ liệu theo loại — nhiều nhất trước. */
  warningSummary: { code: string; count: number }[];
  /** Số dấu hiệu theo mức — CRITICAL trước. */
  bySeverity: { severity: Severity; count: number }[];
  /** Số sinh viên có ít nhất 1 dấu hiệu. */
  studentsWithSignals: number;
}

/** 1 dấu hiệu (RuleTrigger) của sinh viên trong lần chạy. */
export interface RunSignalDto {
  ruleCode: string;
  ruleName: string;
  /** Mã học phần, hoặc null khi luật xét cả học kỳ. */
  courseId: string | null;
  severity: Severity;
  reason: string;
}

/** 1 dòng kết quả đánh giá theo sinh viên: RiskScore + mức dữ liệu + các dấu hiệu. */
export interface RunStudentRowDto {
  studentId: string;
  studentName: string;
  classId: string;
  /** Mức cao nhất trong các dấu hiệu; null khi không có dấu hiệu. */
  maxSeverity: Severity | null;
  signalCount: number;
  riskScore: number | null;
  level: DataCompletenessLevel;
  signals: RunSignalDto[];
}

export const RUN_STUDENT_SORT_KEYS = ['severity', 'riskScore', 'studentId', 'signalCount'] as const;
export type RunStudentSortKey = (typeof RUN_STUDENT_SORT_KEYS)[number];
export const RUN_STUDENT_DEFAULT_SORT = { sort: 'severity', dir: 'desc' } as const;

export interface RunStudentFilter {
  /** false = chỉ sinh viên có dấu hiệu (mặc định). */
  all: boolean;
  severity?: Severity;
  classId?: string;
  ruleCode?: string;
}

export interface EvaluationFormOptionsDto {
  terms: { termId: string; termName: string; isCurrent: boolean }[];
  /** Học phần đã có dữ liệu trong từng học kỳ — để chạy đánh giá riêng 1 học phần. */
  courses: { termId: string; courseId: string; courseName: string; departmentIds: string[] }[];
  /** Khoa để lọc học phần (khoa của lớp sinh hoạt các sinh viên đang học) — docs/rules/07. */
  departments: { departmentId: string; departmentName: string }[];
  /** Chỉ khi DEMO_MODE=true mới chọn được mốc asOf trong quá khứ (docs/rules/06). */
  canChooseAsOf: boolean;
}

/** Số trigger theo lần chạy — COUNT … GROUP BY tường minh (docs/rules/01). */
async function countTriggers(runIds: string[]): Promise<Map<string, number>> {
  if (runIds.length === 0) return new Map();
  const rows = await (
    await getDataSource()
  )
    .getRepository(RuleTrigger)
    .createQueryBuilder('t')
    .select('t.evaluationRunId', 'runId')
    .addSelect('COUNT(*)', 'count')
    .where('t.evaluationRunId IN (:...runIds)', { runIds })
    .groupBy('t.evaluationRunId')
    .getRawMany<{ runId: string; count: string }>();
  return new Map(rows.map((r) => [r.runId, Number(r.count)]));
}

function toListItem(run: EvaluationRun, triggerCount: number): EvaluationRunListItemDto {
  return {
    id: run.id,
    termId: run.termId,
    termName: run.term?.termName ?? run.termId,
    courseId: run.courseId,
    trigger: run.trigger,
    asOf: run.asOf.toISOString(),
    status: run.status,
    totalStudents: run.totalStudents,
    processedStudents: run.processedStudents,
    triggerCount,
    insufficientCount: run.insufficientCount,
    alertsCreated: run.alertsCreated,
    alertsUpdated: run.alertsUpdated,
    triggeredBy: run.triggeredBy,
    createdAt: run.createdAt.toISOString(),
  };
}

export async function getEvaluationFormOptions(): Promise<EvaluationFormOptionsDto> {
  const terms = await (await getDataSource()).getRepository(Term).find({
    select: { termId: true, termName: true, isCurrent: true, closedAt: true, startDate: true },
    order: { isCurrent: 'DESC', startDate: 'DESC' },
    take: 50,
  });
  const open = terms.filter((t) => !t.closedAt);
  const courses =
    open.length === 0
      ? []
      : await (
          await getDataSource()
        )
          .getRepository(Enrollment)
          .createQueryBuilder('e')
          .innerJoin('e.course', 'c')
          .innerJoin(Student, 's', 's.studentId = e.studentId')
          .innerJoin(AdministrativeClass, 'k', 'k.classId = s.classId')
          .select('e.termId', 'termId')
          .addSelect('e.courseId', 'courseId')
          .addSelect('c.courseName', 'courseName')
          .addSelect('ARRAY_AGG(DISTINCT k.departmentId)', 'departmentIds')
          .where('e.termId IN (:...termIds)', { termIds: open.map((t) => t.termId) })
          .groupBy('e.termId')
          .addGroupBy('e.courseId')
          .addGroupBy('c.courseName')
          .orderBy('e.courseId', 'ASC')
          .limit(2000)
          .getRawMany<{
            termId: string;
            courseId: string;
            courseName: string;
            departmentIds: string[];
          }>();
  const departments = await (await getDataSource()).getRepository(Department).find({
    select: { departmentId: true, departmentName: true },
    order: { departmentId: 'ASC' },
  });
  return {
    terms: open.map((t) => ({ termId: t.termId, termName: t.termName, isCurrent: t.isCurrent })),
    courses: courses.map((c) => ({
      termId: c.termId,
      courseId: c.courseId,
      courseName: c.courseName,
      departmentIds: [...c.departmentIds],
    })),
    departments: departments.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentName,
    })),
    canChooseAsOf: getEnv().DEMO_MODE,
  };
}

export async function listEvaluationRuns(
  list: ListParams<RunSortKey> = firstPage(RUN_DEFAULT_SORT),
): Promise<Paged<EvaluationRunListItemDto>> {
  const [runs, total] = await (await getDataSource()).getRepository(EvaluationRun).findAndCount({
    relations: { term: true },
    order: findOrder(
      resolveSort(list, RUN_DEFAULT_SORT).sort,
      resolveSort(list, RUN_DEFAULT_SORT).dir,
      'createdAt',
    ),
    skip: pageOffset(list),
    take: list.size,
  });
  const counts = await countTriggers(runs.map((r) => r.id));
  return {
    items: runs.map((r) => toListItem(r, counts.get(r.id) ?? 0)),
    total,
    page: list.page,
    size: list.size,
  };
}

const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);

export async function getEvaluationRunDetail(
  runId: string,
): Promise<EvaluationRunDetailDto | null> {
  const ds = await getDataSource();
  const run = await ds
    .getRepository(EvaluationRun)
    .findOne({ where: { id: runId }, relations: { term: true } });
  if (!run) return null;
  const [severityRows, studentRow] = await Promise.all([
    ds
      .getRepository(RuleTrigger)
      .createQueryBuilder('t')
      .select('t.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('t.evaluationRunId = :runId', { runId })
      .groupBy('t.severity')
      .getRawMany<{ severity: Severity; count: string }>(),
    ds
      .getRepository(RuleTrigger)
      .createQueryBuilder('t')
      .select('COUNT(DISTINCT t.studentId)', 'count')
      .where('t.evaluationRunId = :runId', { runId })
      .getRawOne<{ count: string }>(),
  ]);
  const counts = new Map(severityRows.map((r) => [r.severity, Number(r.count)]));
  const triggerCount = [...counts.values()].reduce((x, y) => x + y, 0);
  const warningCounts = new Map<string, number>();
  for (const w of run.dataWarnings ?? [])
    warningCounts.set(w.code, (warningCounts.get(w.code) ?? 0) + 1);

  return {
    ...toListItem(run, triggerCount),
    errorMessage: run.errorMessage,
    importBatchId: run.importBatchId,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    warnings: (run.dataWarnings ?? []).map((w) => ({
      code: w.code,
      studentId: w.studentId ?? null,
      courseId: w.courseId ?? null,
      message: w.message,
    })),
    warningSummary: [...warningCounts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    bySeverity: [...SEVERITY_ORDER]
      .reverse()
      .map((severity) => ({ severity, count: counts.get(severity) ?? 0 })),
    studentsWithSignals: Number(studentRow?.count ?? 0),
  };
}

/** Cột ORDER BY theo khóa cho phép (không nối chuỗi từ URL — docs/rules/06). */
const RUN_STUDENT_ORDER: Record<RunStudentSortKey, string> = {
  severity: 't.max_sev',
  riskScore: 'l.risk_score_value',
  studentId: 'l.student_id',
  signalCount: 'signal_count',
};

/** FROM … WHERE dùng chung cho đếm và lấy trang. Tham số dạng mảng ($1…) — docs/rules/06. */
function runStudentQuery(
  runId: string,
  filter: RunStudentFilter,
): { sql: string; args: unknown[] } {
  const args: unknown[] = [runId];
  const where = ['l.evaluation_run_id = $1'];
  if (!filter.all) where.push('t.n > 0');
  if (filter.severity) where.push(`t.max_sev = $${args.push(filter.severity)}`);
  if (filter.classId) where.push(`s.class_id = $${args.push(filter.classId)}`);
  if (filter.ruleCode) {
    const p = args.push(filter.ruleCode);
    where.push(
      `EXISTS (SELECT 1 FROM rule_triggers r WHERE r.evaluation_run_id = $1 AND r.student_id = l.student_id AND r.rule_code = $${p})`,
    );
  }
  const sql = `FROM risk_score_logs l
    JOIN students s ON s.student_id = l.student_id
    LEFT JOIN (
      SELECT student_id, MAX(severity) AS max_sev, COUNT(*) AS n
      FROM rule_triggers WHERE evaluation_run_id = $1 GROUP BY student_id
    ) t ON t.student_id = l.student_id
    WHERE ${where.join(' AND ')}`;
  return { sql, args };
}

interface RunStudentRaw {
  student_id: string;
  full_name: string;
  class_id: string;
  max_sev: Severity | null;
  signal_count: string;
  risk_score_value: number | null;
  data_completeness_level: DataCompletenessLevel;
}

/**
 * Kết quả lần chạy theo sinh viên (docs/rules/07): 1 dòng / sinh viên gồm mức cao nhất, RiskScore,
 * mức dữ liệu và các dấu hiệu — phân trang ở DB, không giới hạn số dấu hiệu.
 */
export async function listRunStudents(
  runId: string,
  filter: RunStudentFilter,
  list: ListParams<RunStudentSortKey> = firstPage(RUN_STUDENT_DEFAULT_SORT),
): Promise<Paged<RunStudentRowDto>> {
  const ds = await getDataSource();
  const { sql, args } = runStudentQuery(runId, filter);
  // Không chọn cột → mặc định mức cao nhất giảm dần (CRITICAL trên cùng, docs/rules/03).
  const sort = list.sort ?? RUN_STUDENT_DEFAULT_SORT.sort;
  const dir = (list.sort ? list.dir : RUN_STUDENT_DEFAULT_SORT.dir) === 'desc' ? 'DESC' : 'ASC';
  const order = [`${RUN_STUDENT_ORDER[sort]} ${dir} NULLS LAST`];
  if (list.sort !== 'riskScore') order.push('l.risk_score_value DESC NULLS LAST');
  if (list.sort !== 'studentId') order.push('l.student_id ASC');
  const [rows, countRows] = await Promise.all([
    ds.query<RunStudentRaw[]>(
      `SELECT l.student_id, s.full_name, s.class_id, t.max_sev, COALESCE(t.n, 0) AS signal_count,
        l.risk_score_value, l.data_completeness_level ${sql}
       ORDER BY ${order.join(', ')}
       LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, list.size, pageOffset(list)],
    ),
    ds.query<{ total: string }[]>(`SELECT COUNT(*) AS total ${sql}`, args),
  ]);
  const signals = await loadRunSignals(
    runId,
    rows.map((r) => r.student_id),
  );
  return {
    items: rows.map((r) => ({
      studentId: r.student_id,
      studentName: r.full_name,
      classId: r.class_id,
      maxSeverity: r.max_sev,
      signalCount: Number(r.signal_count),
      riskScore: r.risk_score_value,
      level: r.data_completeness_level,
      signals: signals.get(r.student_id) ?? [],
    })),
    total: Number(countRows[0]?.total ?? 0),
    page: list.page,
    size: list.size,
  };
}

/** Dấu hiệu của các sinh viên trong 1 trang — mức giảm dần rồi mã luật. */
async function loadRunSignals(
  runId: string,
  studentIds: string[],
): Promise<Map<string, RunSignalDto[]>> {
  if (studentIds.length === 0) return new Map();
  const ds = await getDataSource();
  const [triggers, rules] = await Promise.all([
    ds.getRepository(RuleTrigger).find({
      where: { evaluationRunId: runId, studentId: In(studentIds) },
    }),
    ds.getRepository(Rule).find({ select: { ruleCode: true, ruleName: true } }),
  ]);
  const ruleName = new Map(rules.map((r) => [r.ruleCode, r.ruleName]));
  const out = new Map<string, RunSignalDto[]>();
  for (const t of triggers) {
    const items = out.get(t.studentId) ?? [];
    items.push({
      ruleCode: t.ruleCode,
      ruleName: ruleName.get(t.ruleCode) ?? t.ruleCode,
      courseId: t.scopeId === t.studentId ? null : t.scopeId,
      severity: t.severity,
      reason: t.reason,
    });
    out.set(t.studentId, items);
  }
  for (const items of out.values()) {
    items.sort(
      (a, b) => rank(b.severity) - rank(a.severity) || a.ruleCode.localeCompare(b.ruleCode),
    );
  }
  return out;
}

/** Lựa chọn cho bộ lọc trang kết quả: lớp có trong lần chạy, luật đã kích hoạt. */
export async function listRunFilterOptions(
  runId: string,
): Promise<{ classes: string[]; rules: { ruleCode: string; ruleName: string }[] }> {
  const ds = await getDataSource();
  const [classRows, ruleRows] = await Promise.all([
    ds.query<{ class_id: string }[]>(
      `SELECT DISTINCT s.class_id FROM risk_score_logs l
       JOIN students s ON s.student_id = l.student_id
       WHERE l.evaluation_run_id = $1 ORDER BY s.class_id`,
      [runId],
    ),
    ds.query<{ rule_code: string; rule_name: string | null }[]>(
      `SELECT DISTINCT t.rule_code, r.rule_name FROM rule_triggers t
       LEFT JOIN rules r ON r.rule_code = t.rule_code
       WHERE t.evaluation_run_id = $1 ORDER BY t.rule_code`,
      [runId],
    ),
  ]);
  return {
    classes: classRows.map((r) => r.class_id),
    rules: ruleRows.map((r) => ({ ruleCode: r.rule_code, ruleName: r.rule_name ?? r.rule_code })),
  };
}
