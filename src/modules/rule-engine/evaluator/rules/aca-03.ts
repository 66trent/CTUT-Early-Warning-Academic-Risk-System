import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { gpaBelow, gpaValue, type TermAcademics, termAcademics, termResults } from '../academic';
import { formatNumber, maxSeverity, severitySchema } from '../helpers';
import { type StudentRule } from '../types';

const gpa = z.number().gt(0).max(4);

const conditionSchema = z.object({
  /** Chỉ xét khi tổng tín chỉ có điểm ≥ mức này. */
  minCredits: z.number().int().min(1).max(60),
  /** Mức báo sớm (nhóm đề xuất): ĐTB < ngưỡng. */
  warnBelow: gpa,
  warnSeverity: severitySchema,
  /** Ngưỡng quy chế (Điều 11b): học kỳ thường / học kỳ đầu khóa. */
  regulationBelow: gpa,
  firstTermRegulationBelow: gpa,
  regulationSeverity: severitySchema,
});
export type Aca03Condition = z.infer<typeof conditionSchema>;

/** Mức ACA-03 của 1 học kỳ (dùng lại cho học kỳ trước ở ACA-04). Hàm thuần. */
export function assessGpa(academics: TermAcademics, c: Aca03Condition, isFirstTerm: boolean) {
  if (academics.credits < c.minCredits) return { severity: null, regulation: null };
  const regulation = isFirstTerm ? c.firstTermRegulationBelow : c.regulationBelow;
  if (gpaBelow(academics, regulation)) {
    return { severity: c.regulationSeverity, regulation };
  }
  return { severity: gpaBelow(academics, c.warnBelow) ? c.warnSeverity : null, regulation: null };
}

/**
 * ACA-03 — ĐTB học kỳ thấp (docs/rules/08, Quy chế 336 Điều 11b). ĐTB hệ 4 quy đổi từ điểm chữ
 * theo `gradeScale` của RISK-SCORE (A = 3,8); so sánh số nguyên phần mười.
 */
export const aca03: StudentRule<Aca03Condition> = {
  kind: 'PER_STUDENT',
  meta: {
    ruleCode: 'ACA-03',
    ruleName: 'ĐTB học kỳ thấp',
    ruleGroup: RuleGroup.ACADEMIC,
    scope: 'PER_STUDENT',
    priority: 80,
    signal: 'ACADEMIC',
    requires: null,
  },
  conditionSchema,
  defaultCondition: {
    minCredits: 1,
    warnBelow: 2,
    warnSeverity: Severity.HIGH,
    regulationBelow: 1,
    firstTermRegulationBelow: 0.8,
    regulationSeverity: Severity.CRITICAL,
  },
  maxSeverity: (c) => maxSeverity([c.warnSeverity, c.regulationSeverity]) ?? Severity.CRITICAL,

  evaluate(ctx, c) {
    const academics = termAcademics(termResults(ctx.facts), ctx.config.academic.gradeScale);
    const { severity, regulation } = assessGpa(academics, c, ctx.isFirstTerm);
    if (!severity) return { hit: null, warnings: academics.warnings };
    const value = gpaValue(academics) ?? 0;
    const missing =
      ctx.missingResults > 0 ? ` Còn ${ctx.missingResults} học phần chưa có kết quả.` : '';
    return {
      hit: {
        severity,
        reason:
          `ĐTB học kỳ (hệ 4) ${formatNumber(value)} trên ${academics.credits} tín chỉ` +
          (regulation !== null
            ? ` — dưới ${formatNumber(regulation, 1)}, chạm ngưỡng cảnh báo học tập theo quy chế${ctx.isFirstTerm ? ' (học kỳ đầu khóa)' : ''} (tham khảo).`
            : ` — dưới ${formatNumber(c.warnBelow, 1)}.`) +
          missing,
        inputSnapshot: {
          gpa4: value,
          credits: academics.credits,
          threshold: regulation ?? c.warnBelow,
          firstTerm: ctx.isFirstTerm,
          missingResults: ctx.missingResults,
        },
      },
      warnings: academics.warnings,
    };
  },
};
