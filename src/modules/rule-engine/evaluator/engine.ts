import { DataStatus, type RuleGroup, type Severity } from '@/db/enums';
import { type RiskScoreConfig } from './config';
import { buildEnrollmentFacts } from './facts';
import { computeRiskScore, type RiskScoreResult } from './risk-score';
import { RULES } from './rules';
import {
  type ActiveRule,
  type CourseRule,
  type DataWarning,
  type EnrollmentFacts,
  type RuleDefinition,
  type StudentInput,
  type StudentRule,
  type TriggerOutput,
} from './types';

export interface EvaluationContext {
  asOf: Date;
  /** Phiên bản ACTIVE của từng luật (`ruleCode` → version). Luật không có thì không chạy. */
  activeRules: ReadonlyMap<string, ActiveRule>;
  /** `condition` đã parse của `RISK-SCORE`. */
  config: RiskScoreConfig;
  /** Chỉ chạy luật PER_COURSE của học phần này (chạy theo học phần). */
  courseId?: string | null;
}

export interface StudentEvaluation {
  studentId: string;
  triggers: TriggerOutput[];
  riskScore: RiskScoreResult;
  warnings: DataWarning[];
}

/** Ngoại lệ bước 3: nhóm dữ liệu luật cần phải AVAILABLE. */
function dataReady(rule: RuleDefinition, facts: EnrollmentFacts): boolean {
  if (rule.meta.requires === 'ATTENDANCE') return facts.attendance.status === DataStatus.AVAILABLE;
  if (rule.meta.requires === 'LMS') return facts.lms.status === DataStatus.AVAILABLE;
  return true;
}

function courseRules(stage: 'BASE' | 'COMBINED'): CourseRule<unknown>[] {
  return RULES.filter(
    (r): r is CourseRule<unknown> => r.kind === 'PER_COURSE' && r.stage === stage,
  );
}

/** Bước 6 cho 1 Enrollment: luật BASE rồi COMB-* trên kết quả vừa có. */
function evaluateEnrollment(
  facts: EnrollmentFacts,
  ctx: EvaluationContext,
  warnings: DataWarning[],
): TriggerOutput[] {
  const triggers: TriggerOutput[] = [];
  const priorHits: { ruleCode: string; ruleGroup: RuleGroup; severity: Severity }[] = [];
  for (const stage of ['BASE', 'COMBINED'] as const) {
    for (const rule of courseRules(stage)) {
      const active = ctx.activeRules.get(rule.meta.ruleCode);
      if (!active || !dataReady(rule, facts)) continue;
      const outcome = rule.evaluate({ facts, asOf: ctx.asOf, priorHits }, active.condition);
      warnings.push(...(outcome.warnings ?? []));
      if (!outcome.hit) continue;
      triggers.push({
        ...outcome.hit,
        ruleCode: rule.meta.ruleCode,
        ruleVersionId: active.ruleVersionId,
        scopeId: facts.input.courseId,
      });
      if (stage === 'BASE') {
        priorHits.push({
          ruleCode: rule.meta.ruleCode,
          ruleGroup: rule.meta.ruleGroup,
          severity: outcome.hit.severity,
        });
      }
    }
  }
  return triggers;
}

/**
 * Đánh giá 1 sinh viên trong 1 học kỳ theo trình tự 10 bước của docs/rules/08 (bước 1–6;
 * bước 7–10 tạo Alert/thông báo ở Phase 5). Hàm thuần — không truy vấn DB.
 */
export function evaluateStudent(input: StudentInput, ctx: EvaluationContext): StudentEvaluation {
  const warnings: DataWarning[] = [];
  // Bước 1–4: dữ kiện theo asOf (loại INVALID, trạng thái, lần học, DataStatus).
  const facts = input.enrollments.map((e) => buildEnrollmentFacts(e, ctx.asOf, ctx.config));
  for (const f of facts) {
    if (f.attendance.status === DataStatus.INVALID) {
      warnings.push({
        code: 'ATTENDANCE_INVALID',
        courseId: f.input.courseId,
        message: 'Số liệu điểm danh mâu thuẫn (tổng các cột vượt số buổi đã học) — bỏ qua.',
      });
    }
  }
  // Bước 5: RiskScore.
  const riskScore = computeRiskScore(facts, ctx.config);

  // Bước 2–3 + 6: luật theo học phần chỉ xét REGISTERED (bỏ WITHDRAWN, COMPLETED).
  const triggers: TriggerOutput[] = [];
  for (const f of facts) {
    if (f.state !== 'REGISTERED') continue;
    if (ctx.courseId && f.input.courseId !== ctx.courseId) continue;
    triggers.push(...evaluateEnrollment(f, ctx, warnings));
  }
  // ACA-02/ACA-03: theo sinh viên × học kỳ, xét cả COMPLETED, bỏ WITHDRAWN.
  const studentFacts = facts.filter((f) => f.state !== 'WITHDRAWN');
  for (const rule of RULES.filter((r): r is StudentRule<unknown> => r.kind === 'PER_STUDENT')) {
    const active = ctx.activeRules.get(rule.meta.ruleCode);
    if (!active) continue;
    const outcome = rule.evaluate(studentFacts, active.condition);
    warnings.push(...(outcome.warnings ?? []));
    if (outcome.hit) {
      triggers.push({
        ...outcome.hit,
        ruleCode: rule.meta.ruleCode,
        ruleVersionId: active.ruleVersionId,
        scopeId: input.studentId,
      });
    }
  }
  return { studentId: input.studentId, triggers, riskScore, warnings };
}
