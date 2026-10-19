import { In, type EntityManager } from 'typeorm';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { RuleStatus, type Severity } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { riskScoreConfigSchema, RISK_SCORE_RULE_CODE } from '../evaluator/config';
import {
  evaluateStudent,
  type EvaluationContext,
  type StudentEvaluation,
} from '../evaluator/engine';
import { maxSeverity } from '../evaluator/helpers';
import {
  findPreviousTerm,
  listTermStudents,
  loadLmsContexts,
  loadStudentInputs,
} from './evaluation-loader';
import { EVALUATION_CHUNK_SIZE } from './evaluation-run.service';
import { loadActiveRuleSet, parseCondition } from './rule-config.service';

/** Số dòng tối đa của danh sách sinh viên thêm/bớt (người dùng chốt 2026-10-13, docs/rules/11). */
export const DRY_RUN_LIST_LIMIT = 50;

export interface DryRunSide {
  /** Số sinh viên có trigger của luật này (RISK-SCORE: của mọi luật). */
  students: number;
  triggers: number;
  bySeverity: Partial<Record<Severity, number>>;
  /** Điểm rủi ro trung bình trên sinh viên đủ dữ liệu tính điểm; null = không ai đủ dữ liệu. */
  averageRisk: number | null;
}

export interface DryRunStudentDto {
  studentId: string;
  fullName: string;
  classId: string;
  /** Mức cao nhất của sinh viên ở phía có dấu hiệu. */
  severity: Severity;
}

export interface DryRunResultDto {
  ruleCode: string;
  version: number;
  termId: string;
  asOf: string;
  studentsEvaluated: number;
  current: DryRunSide;
  proposed: DryRunSide;
  /** Có dấu hiệu theo bản nháp nhưng không có theo bản đang áp dụng. */
  added: DryRunStudentDto[];
  addedCount: number;
  /** Có dấu hiệu theo bản đang áp dụng nhưng không còn theo bản nháp. */
  removed: DryRunStudentDto[];
  removedCount: number;
}

/** Gom kết quả 1 phía: mức cao nhất theo sinh viên + tổng điểm rủi ro. */
class SideTally {
  readonly bySeverity: Partial<Record<Severity, number>> = {};
  readonly studentSeverity = new Map<string, Severity>();
  triggers = 0;
  private riskSum = 0;
  private riskCount = 0;

  constructor(private readonly ruleCode: string | null) {}

  add(evaluation: StudentEvaluation) {
    if (evaluation.riskScore.value !== null) {
      this.riskSum += evaluation.riskScore.value;
      this.riskCount += 1;
    }
    const mine = evaluation.triggers.filter(
      (t) => this.ruleCode === null || t.ruleCode === this.ruleCode,
    );
    if (mine.length === 0) return;
    this.triggers += mine.length;
    for (const t of mine) this.bySeverity[t.severity] = (this.bySeverity[t.severity] ?? 0) + 1;
    const top = maxSeverity(mine.map((t) => t.severity));
    if (top) this.studentSeverity.set(evaluation.studentId, top);
  }

  toSide(): DryRunSide {
    return {
      students: this.studentSeverity.size,
      triggers: this.triggers,
      bySeverity: { ...this.bySeverity },
      averageRisk: this.riskCount > 0 ? this.riskSum / this.riskCount : null,
    };
  }
}

/** Sinh viên có ở `a` mà không có ở `b` — sắp theo mã, kèm mức ở phía `a`. */
const difference = (a: Map<string, Severity>, b: Map<string, Severity>) =>
  [...a.entries()].filter(([id]) => !b.has(id)).sort(([x], [y]) => x.localeCompare(y));

async function describeStudents(
  em: EntityManager,
  entries: [string, Severity][],
): Promise<DryRunStudentDto[]> {
  const shown = entries.slice(0, DRY_RUN_LIST_LIMIT);
  if (shown.length === 0) return [];
  const students = await em.find(Student, {
    select: { studentId: true, fullName: true, classId: true },
    where: { studentId: In(shown.map(([id]) => id)) },
  });
  const byId = new Map(students.map((s) => [s.studentId, s]));
  return shown.map(([studentId, severity]) => ({
    studentId,
    fullName: byId.get(studentId)?.fullName ?? studentId,
    classId: byId.get(studentId)?.classId ?? '',
    severity,
  }));
}

/** Bộ luật hiện tại và bộ luật giả định khi bản nháp được kích hoạt. */
async function buildContexts(
  em: EntityManager,
  version: RuleVersion,
  asOf: Date,
): Promise<[EvaluationContext, EvaluationContext]> {
  const current = await loadActiveRuleSet(em);
  const proposedRules = new Map(current.activeRules);
  let proposedConfig = current.config;
  if (version.ruleCode === RISK_SCORE_RULE_CODE) {
    proposedConfig = riskScoreConfigSchema.parse(version.condition);
  } else {
    proposedRules.set(version.ruleCode, {
      ruleVersionId: version.id,
      condition: parseCondition(version.ruleCode, version.condition),
    });
  }
  return [
    { asOf, activeRules: current.activeRules, config: current.config },
    { asOf, activeRules: proposedRules, config: proposedConfig },
  ];
}

/**
 * Chạy thử 1 phiên bản NHÁP trên dữ liệu thật của 1 học kỳ — CHỈ ĐỌC: không ghi trigger, chỉ
 * ghi `lastDryRunAt` + Audit Log. So với phiên bản ACTIVE: số sinh viên bị ảnh hưởng và danh
 * sách sinh viên thêm/bớt (docs/rules/11). RISK-SCORE ảnh hưởng mọi luật → đếm trigger mọi luật.
 */
export async function dryRunRuleVersion(
  em: EntityManager,
  versionId: string,
  termId: string,
  actorId: string,
  asOf = new Date(),
): Promise<DryRunResultDto> {
  const version = await em.findOneBy(RuleVersion, { id: versionId });
  if (!version) throw new AppError('RULE_VERSION_NOT_FOUND', 'Không tìm thấy phiên bản luật.');
  if (version.status !== RuleStatus.DRAFT) {
    throw new AppError('INVALID_STATUS', 'Chỉ chạy thử được phiên bản nháp.');
  }
  const term = await em.findOneBy(Term, { termId });
  if (!term) throw new AppError('TERM_NOT_FOUND', 'Không tìm thấy học kỳ.');

  const contexts = await buildContexts(em, version, asOf);
  const ruleFilter = version.ruleCode === RISK_SCORE_RULE_CODE ? null : version.ruleCode;
  const tallies = [new SideTally(ruleFilter), new SideTally(ruleFilter)] as const;
  const previousTerm = await findPreviousTerm(em, term);
  const students = await listTermStudents(em, termId, null);
  const lms = [
    await loadLmsContexts(em, termId, asOf, contexts[0].config.lms),
    await loadLmsContexts(em, termId, asOf, contexts[1].config.lms),
  ] as const;
  for (let i = 0; i < students.length; i += EVALUATION_CHUNK_SIZE) {
    const ids = students.slice(i, i + EVALUATION_CHUNK_SIZE);
    for (const side of [0, 1] as const) {
      const inputs = await loadStudentInputs(em, { term, previousTerm }, ids, asOf, lms[side]);
      for (const input of inputs) tallies[side].add(evaluateStudent(input, contexts[side]));
    }
  }

  const added = difference(tallies[1].studentSeverity, tallies[0].studentSeverity);
  const removed = difference(tallies[0].studentSeverity, tallies[1].studentSeverity);
  const result: DryRunResultDto = {
    ruleCode: version.ruleCode,
    version: version.version,
    termId,
    asOf: asOf.toISOString(),
    studentsEvaluated: students.length,
    current: tallies[0].toSide(),
    proposed: tallies[1].toSide(),
    added: await describeStudents(em, added),
    addedCount: added.length,
    removed: await describeStudents(em, removed),
    removedCount: removed.length,
  };

  await em.update(RuleVersion, { id: versionId }, { lastDryRunAt: new Date() });
  await writeAuditLog(
    {
      actorId,
      action: 'RULE_DRY_RUN',
      targetType: 'RuleVersion',
      targetId: versionId,
      detail: {
        termId,
        asOf: result.asOf,
        current: result.current.students,
        proposed: result.proposed.students,
        added: result.addedCount,
        removed: result.removedCount,
      },
    },
    em,
  );
  return result;
}
