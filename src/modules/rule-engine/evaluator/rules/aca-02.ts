import { z } from 'zod';
import { RuleGroup, Severity, type Severity as SeverityType } from '@/db/enums';
import { type TermAcademics, termAcademics, termResults } from '../academic';
import { formatPercent, maxSeverity } from '../helpers';
import { type StudentRule } from '../types';
import { matchPercentBands, percentBandsSchema } from './att-01';

const conditionSchema = z.object({ bands: percentBandsSchema });
export type Aca02Condition = z.infer<typeof conditionSchema>;

/** Mức ACA-02 của 1 học kỳ (dùng lại cho học kỳ trước ở ACA-04). Hàm thuần. */
export function assessFailedCredits(
  academics: TermAcademics,
  c: Aca02Condition,
): { severity: SeverityType | null; exceeded: number | null } {
  if (academics.credits === 0) return { severity: null, exceeded: null };
  return matchPercentBands(c.bands, academics.failedCredits, academics.credits);
}

/**
 * ACA-02 — Tín chỉ không đạt trong học kỳ (docs/rules/08, Quy chế 336 Điều 11a): tỷ lệ tín chỉ
 * không đạt / tín chỉ có kết quả; > 50% = chạm ngưỡng quy chế. So sánh số nguyên.
 */
export const aca02: StudentRule<Aca02Condition> = {
  kind: 'PER_STUDENT',
  meta: {
    ruleCode: 'ACA-02',
    ruleName: 'Tín chỉ không đạt trong học kỳ',
    ruleGroup: RuleGroup.ACADEMIC,
    scope: 'PER_STUDENT',
    priority: 70,
    signal: 'ACADEMIC',
    requires: null,
  },
  conditionSchema,
  defaultCondition: {
    bands: [
      { percent: 25, op: 'gte', severity: Severity.HIGH },
      { percent: 50, op: 'gt', severity: Severity.CRITICAL },
    ],
  },
  maxSeverity: (c) => maxSeverity(c.bands.map((b) => b.severity)) ?? Severity.CRITICAL,

  evaluate(ctx, c) {
    const academics = termAcademics(termResults(ctx.facts), ctx.config.academic.gradeScale);
    const { severity, exceeded } = assessFailedCredits(academics, c);
    if (!severity) return { hit: null, warnings: academics.warnings };
    const missing =
      ctx.missingResults > 0 ? ` Còn ${ctx.missingResults} học phần chưa có kết quả.` : '';
    return {
      hit: {
        severity,
        reason:
          `Không đạt ${academics.failedCredits}/${academics.credits} tín chỉ (${formatPercent(academics.failedCredits / academics.credits)}): ${academics.failedCourses
            .map((r) => r.courseName)
            .join(', ')}` +
          (exceeded
            ? ` — chạm ngưỡng cảnh báo học tập theo quy chế (> ${exceeded}%, tham khảo).`
            : '.') +
          missing,
        inputSnapshot: {
          failedCredits: academics.failedCredits,
          credits: academics.credits,
          failedCourses: academics.failedCourses.map((r) => r.courseId).join(','),
          missingResults: ctx.missingResults,
        },
      },
      warnings: academics.warnings,
    };
  },
};
