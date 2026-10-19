import { DataStatus } from '@/db/enums';
import { type RiskScoreConfig } from './config';
import { buildEnrollmentFacts } from './facts';
import { computeRiskScore, type RiskScoreResult } from './risk-score';
import { RULES } from './rules';
import {
  type ActiveRule,
  type CourseRule,
  type DataWarning,
  type EnrollmentFacts,
  type PriorHit,
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
  /**
   * Lần chạy chốt học kỳ (`TERM_CLOSING`): ACA-02/03/04 chạy cả khi sinh viên còn học phần chưa
   * có kết quả, tính trên các học phần đã có (docs/rules/08).
   */
  termClosing?: boolean;
}

export interface StudentEvaluation {
  studentId: string;
  triggers: TriggerOutput[];
  riskScore: RiskScoreResult;
  warnings: DataWarning[];
  /**
   * Học phần đang học có điểm danh QUÁ HẠN (STALE) tại asOf: luật điểm danh không chạy được — dấu
   * hiệu điểm danh cũ của học phần này được GIỮ, không coi là đã hết (docs/rules/08, chốt 2026-10-15).
   */
  staleScopes: string[];
}

/** Ngoại lệ bước 3: nhóm dữ liệu luật cần phải AVAILABLE. */
function dataReady(rule: RuleDefinition, facts: EnrollmentFacts): boolean {
  if (rule.meta.requires === 'ATTENDANCE') return facts.attendance.status === DataStatus.AVAILABLE;
  if (rule.meta.requires === 'LMS_QUIZ') return facts.quiz.status === DataStatus.AVAILABLE;
  if (rule.meta.requires === 'LMS_ASSIGNMENT') {
    return facts.assignment.status === DataStatus.AVAILABLE;
  }
  return true;
}

function courseRules(stage: 'BASE' | 'COMBINED', state: string): CourseRule<unknown>[] {
  return RULES.filter(
    (r): r is CourseRule<unknown> =>
      r.kind === 'PER_COURSE' && r.stage === stage && r.appliesTo === state,
  );
}

/** Bước 6 cho 1 Enrollment: luật BASE rồi COMB-* trên kết quả vừa có. */
function evaluateEnrollment(
  facts: EnrollmentFacts,
  ctx: EvaluationContext,
  warnings: DataWarning[],
): TriggerOutput[] {
  const triggers: TriggerOutput[] = [];
  const priorHits: PriorHit[] = [];
  for (const stage of ['BASE', 'COMBINED'] as const) {
    for (const rule of courseRules(stage, facts.state)) {
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
          signal: rule.meta.signal,
          severity: outcome.hit.severity,
        });
      }
    }
  }
  return triggers;
}

/** ACA-02/03/04: theo sinh viên × học kỳ, chỉ khi đủ kết quả học kỳ hoặc lần chạy chốt học kỳ. */
function evaluateStudentRules(
  input: StudentInput,
  facts: readonly EnrollmentFacts[],
  ctx: EvaluationContext,
  warnings: DataWarning[],
): TriggerOutput[] {
  const studentFacts = facts.filter((f) => f.state !== 'WITHDRAWN');
  const missingResults = studentFacts.filter((f) => f.state !== 'COMPLETED').length;
  if (studentFacts.length === 0 || (missingResults > 0 && !ctx.termClosing)) return [];
  const triggers: TriggerOutput[] = [];
  const studentCtx = {
    facts: studentFacts,
    isFirstTerm: input.isFirstTerm,
    missingResults,
    previousTerm: input.previousTerm,
    config: ctx.config,
    conditionOf: (ruleCode: string) => ctx.activeRules.get(ruleCode)?.condition,
  };
  for (const rule of RULES.filter((r): r is StudentRule<unknown> => r.kind === 'PER_STUDENT')) {
    const active = ctx.activeRules.get(rule.meta.ruleCode);
    if (!active) continue;
    const outcome = rule.evaluate(studentCtx, active.condition);
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
  return triggers;
}

/** Cảnh báo chất lượng dữ liệu trùng (cùng mã, học phần, nội dung) chỉ giữ 1. */
function uniqueWarnings(warnings: readonly DataWarning[]): DataWarning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.code}|${w.courseId ?? ''}|${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Đánh giá 1 sinh viên trong 1 học kỳ theo trình tự 10 bước của docs/rules/08 (bước 1–6;
 * bước 7–10 tạo Alert/thông báo ở module alerts). Hàm thuần — không truy vấn DB.
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
        message: 'Số liệu điểm danh mâu thuẫn (tiết vắng vượt tổng số tiết) — bỏ qua.',
      });
    }
  }
  // Bước 5: RiskScore.
  const riskScore = computeRiskScore(facts, input.previousTerm, ctx.config);

  // Bước 2–3 + 6: luật theo học phần — mỗi luật xét đúng trạng thái Enrollment của nó.
  const triggers: TriggerOutput[] = [];
  for (const f of facts) {
    if (f.state === 'WITHDRAWN') continue;
    if (ctx.courseId && f.input.courseId !== ctx.courseId) continue;
    triggers.push(...evaluateEnrollment(f, ctx, warnings));
  }
  triggers.push(...evaluateStudentRules(input, facts, ctx, warnings));
  const staleScopes = facts
    .filter((f) => f.state === 'REGISTERED' && f.attendance.status === DataStatus.STALE)
    .map((f) => f.input.courseId);
  return {
    studentId: input.studentId,
    triggers,
    riskScore,
    warnings: uniqueWarnings(warnings),
    staleScopes,
  };
}
