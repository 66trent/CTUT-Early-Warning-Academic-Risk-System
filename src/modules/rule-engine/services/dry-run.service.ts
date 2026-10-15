import { type EntityManager } from 'typeorm';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { Term } from '@/db/entities/term.entity';
import { RuleStatus, type Severity } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { riskScoreConfigSchema, RISK_SCORE_RULE_CODE } from '../evaluator/config';
import { evaluateStudent, type EvaluationContext } from '../evaluator/engine';
import { listTermStudents, loadLmsContexts, loadStudentInputs } from './evaluation-loader';
import { EVALUATION_CHUNK_SIZE } from './evaluation-run.service';
import { loadActiveRuleSet, parseCondition } from './rule-config.service';

export interface DryRunSide {
  /** Số sinh viên có trigger của luật này. */
  students: number;
  triggers: number;
  bySeverity: Partial<Record<Severity, number>>;
}

export interface DryRunResultDto {
  ruleCode: string;
  version: number;
  termId: string;
  asOf: string;
  studentsEvaluated: number;
  current: DryRunSide;
  proposed: DryRunSide;
}

const emptySide = (): DryRunSide => ({ students: 0, triggers: 0, bySeverity: {} });

function tally(
  side: DryRunSide,
  ruleCode: string,
  studentId: string,
  ts: { ruleCode: string; severity: Severity }[],
) {
  const mine = ts.filter((t) => t.ruleCode === ruleCode);
  if (mine.length === 0) return;
  side.students += 1;
  side.triggers += mine.length;
  for (const t of mine) side.bySeverity[t.severity] = (side.bySeverity[t.severity] ?? 0) + 1;
}

/**
 * Chạy thử 1 phiên bản NHÁP trên dữ liệu thật của 1 học kỳ — CHỈ ĐỌC: không ghi trigger, chỉ
 * ghi `lastDryRunAt` + Audit Log. So với phiên bản ACTIVE: ước tính số sinh viên bị ảnh hưởng.
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
  const contexts: [EvaluationContext, EvaluationContext] = [
    { asOf, activeRules: current.activeRules, config: current.config },
    { asOf, activeRules: proposedRules, config: proposedConfig },
  ];
  const result: DryRunResultDto = {
    ruleCode: version.ruleCode,
    version: version.version,
    termId,
    asOf: asOf.toISOString(),
    studentsEvaluated: 0,
    current: emptySide(),
    proposed: emptySide(),
  };
  const students = await listTermStudents(em, termId, null);
  const lms = [
    await loadLmsContexts(em, termId, asOf, current.config.lms),
    await loadLmsContexts(em, termId, asOf, proposedConfig.lms),
  ] as const;
  for (let i = 0; i < students.length; i += EVALUATION_CHUNK_SIZE) {
    const ids = students.slice(i, i + EVALUATION_CHUNK_SIZE);
    for (const [index, side] of [result.current, result.proposed].entries()) {
      const inputs = await loadStudentInputs(em, term, ids, asOf, lms[index] ?? lms[0]);
      for (const input of inputs) {
        const evaluation = evaluateStudent(input, contexts[index] ?? contexts[0]);
        tally(side, version.ruleCode, input.studentId, evaluation.triggers);
      }
    }
    result.studentsEvaluated += ids.length;
  }

  await em.update(RuleVersion, { id: versionId }, { lastDryRunAt: new Date() });
  await writeAuditLog(
    {
      actorId,
      action: 'RULE_DRY_RUN',
      targetType: 'RuleVersion',
      targetId: versionId,
      detail: { termId, current: result.current.triggers, proposed: result.proposed.triggers },
    },
    em,
  );
  return result;
}
