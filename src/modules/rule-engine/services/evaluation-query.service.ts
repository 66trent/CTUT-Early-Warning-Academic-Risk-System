import { In } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Department } from '@/db/entities/department.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { RiskScoreLog } from '@/db/entities/risk-score-log.entity';
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
import { findOrder, firstPage, type ListParams, type Paged, pageOffset } from '@/lib/list-params';

export const RUN_SORT_KEYS = ['createdAt', 'asOf', 'status'] as const;
export type RunSortKey = (typeof RUN_SORT_KEYS)[number];
export const RUN_DEFAULT_SORT = { sort: 'createdAt', dir: 'desc' } as const;
/** Giới hạn số dòng hiển thị trên trang chi tiết (giao diện CVHT đầy đủ ở Phase 5). */
const DETAIL_LIMIT = 500;

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

export interface EvaluationTriggerDto {
  studentId: string;
  studentName: string;
  classId: string;
  scopeId: string;
  ruleCode: string;
  ruleName: string;
  severity: Severity;
  reason: string;
}

export interface EvaluationRiskDto {
  studentId: string;
  studentName: string;
  value: number | null;
  level: DataCompletenessLevel;
}

export interface EvaluationRunDetailDto extends EvaluationRunListItemDto {
  errorMessage: string | null;
  importBatchId: string | null;
  finishedAt: string | null;
  warnings: { code: string; studentId: string | null; courseId: string | null; message: string }[];
  /** Số cảnh báo chất lượng dữ liệu theo loại — nhiều nhất trước. */
  warningSummary: { code: string; count: number }[];
  triggers: EvaluationTriggerDto[];
  risks: EvaluationRiskDto[];
  bySeverity: { severity: Severity; count: number }[];
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
    order: findOrder(list.sort ?? 'createdAt', list.dir, 'createdAt'),
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
  const [triggers, logs, rules] = await Promise.all([
    ds.getRepository(RuleTrigger).find({ where: { evaluationRunId: runId }, take: DETAIL_LIMIT }),
    ds.getRepository(RiskScoreLog).find({ where: { evaluationRunId: runId }, take: DETAIL_LIMIT }),
    ds.getRepository(Rule).find({ select: { ruleCode: true, ruleName: true } }),
  ]);
  const students = await ds.getRepository(Student).find({
    select: { studentId: true, fullName: true, classId: true },
    where: { studentId: In([...new Set([...triggers, ...logs].map((t) => t.studentId))]) },
  });
  const studentOf = new Map(students.map((s) => [s.studentId, s]));
  const ruleName = new Map(rules.map((r) => [r.ruleCode, r.ruleName]));
  const warningCounts = new Map<string, number>();
  for (const w of run.dataWarnings ?? [])
    warningCounts.set(w.code, (warningCounts.get(w.code) ?? 0) + 1);
  const counts = new Map<Severity, number>();
  for (const t of triggers) counts.set(t.severity, (counts.get(t.severity) ?? 0) + 1);

  return {
    ...toListItem(run, triggers.length),
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
    triggers: triggers
      .map((t) => ({
        studentId: t.studentId,
        studentName: studentOf.get(t.studentId)?.fullName ?? t.studentId,
        classId: studentOf.get(t.studentId)?.classId ?? '',
        scopeId: t.scopeId,
        ruleCode: t.ruleCode,
        ruleName: ruleName.get(t.ruleCode) ?? t.ruleCode,
        severity: t.severity,
        reason: t.reason,
      }))
      .sort(
        (a, b) =>
          rank(b.severity) - rank(a.severity) ||
          a.studentId.localeCompare(b.studentId) ||
          a.ruleCode.localeCompare(b.ruleCode),
      ),
    risks: logs
      .map((l) => ({
        studentId: l.studentId,
        studentName: studentOf.get(l.studentId)?.fullName ?? l.studentId,
        value: l.riskScoreValue,
        level: l.dataCompletenessLevel,
      }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.studentId.localeCompare(b.studentId)),
    bySeverity: [...SEVERITY_ORDER]
      .reverse()
      .map((severity) => ({ severity, count: counts.get(severity) ?? 0 })),
  };
}
