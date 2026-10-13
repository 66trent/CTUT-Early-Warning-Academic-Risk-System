import { In } from 'typeorm';
import { getDataSource } from '@/db/data-source';
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

export const RUNS_PAGE_SIZE = 20;
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
  triggers: EvaluationTriggerDto[];
  risks: EvaluationRiskDto[];
  bySeverity: { severity: Severity; count: number }[];
}

export interface EvaluationFormOptionsDto {
  terms: { termId: string; termName: string; isCurrent: boolean }[];
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
  return {
    terms: terms
      .filter((t) => !t.closedAt)
      .map((t) => ({ termId: t.termId, termName: t.termName, isCurrent: t.isCurrent })),
    canChooseAsOf: getEnv().DEMO_MODE,
  };
}

export async function listEvaluationRuns(
  page: number,
): Promise<{ items: EvaluationRunListItemDto[]; total: number }> {
  const [runs, total] = await (await getDataSource()).getRepository(EvaluationRun).findAndCount({
    relations: { term: true },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * RUNS_PAGE_SIZE,
    take: RUNS_PAGE_SIZE,
  });
  const counts = await countTriggers(runs.map((r) => r.id));
  return { items: runs.map((r) => toListItem(r, counts.get(r.id) ?? 0)), total };
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
