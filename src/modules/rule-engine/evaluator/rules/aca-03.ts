import { z } from 'zod';
import { CourseResultStatus, RuleGroup, Severity } from '@/db/enums';
import { formatNumber, severitySchema } from '../helpers';
import { type DataWarning, type StudentRule } from '../types';

const conditionSchema = z.object({
  /** Chỉ xét khi tổng tín chỉ có điểm ≥ mức này. */
  minCredits: z.number().int().min(1).max(60),
  /** GPA hệ 4 dưới mức này thì kích hoạt — `< threshold`, bội số của 0,5. */
  threshold: z.number().gt(0).max(4).multipleOf(0.5),
  /** Quy đổi điểm chữ → hệ 4 theo quy chế trường (người dùng xác nhận). */
  gradeScale: z.record(z.string().min(1).max(2), z.number().min(0).max(4).multipleOf(0.5)),
  severity: severitySchema,
});
export type Aca03Condition = z.infer<typeof conditionSchema>;

/**
 * ACA-03 — Điểm trung bình học kỳ thấp (docs/rules/08). GPA4 quy đổi từ `letterGrade` lúc đánh
 * giá (không lưu). So sánh theo nửa điểm bằng số nguyên: Σ(2×điểm×TC) < 2×ngưỡng × ΣTC.
 */
export const aca03: StudentRule<Aca03Condition> = {
  kind: 'PER_STUDENT',
  meta: {
    ruleCode: 'ACA-03',
    ruleName: 'Điểm trung bình học kỳ thấp',
    ruleGroup: RuleGroup.ACADEMIC,
    scope: 'PER_STUDENT',
    priority: 80,
    requires: null,
  },
  conditionSchema,
  defaultCondition: {
    minCredits: 6,
    threshold: 2,
    gradeScale: { 'A+': 4, A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, 'D+': 1.5, D: 1, F: 0 },
    severity: Severity.HIGH,
  },
  maxSeverity: (c) => c.severity,

  evaluate(facts, c) {
    const warnings: DataWarning[] = [];
    let credits = 0;
    let doubledPoints = 0;
    for (const f of facts) {
      const r = f.result;
      if (r?.resultStatus !== CourseResultStatus.FINAL || !r.letterGrade || !f.input.credits) {
        continue;
      }
      const point = c.gradeScale[r.letterGrade];
      if (point === undefined) {
        warnings.push({
          code: 'UNKNOWN_LETTER_GRADE',
          courseId: f.input.courseId,
          message: `Điểm chữ "${r.letterGrade}" chưa có trong thang quy đổi — bỏ qua khi tính GPA.`,
        });
        continue;
      }
      credits += f.input.credits;
      doubledPoints += Math.round(point * 2) * f.input.credits;
    }
    if (credits < c.minCredits) return { hit: null, warnings };
    if (doubledPoints >= Math.round(c.threshold * 2) * credits) return { hit: null, warnings };
    const gpa = doubledPoints / 2 / credits;
    return {
      hit: {
        severity: c.severity,
        reason: `Điểm trung bình học kỳ (hệ 4) ${formatNumber(gpa)} dưới ${formatNumber(c.threshold, 1)} trên ${credits} tín chỉ.`,
        inputSnapshot: { gpa4: gpa, credits, threshold: c.threshold },
      },
      warnings,
    };
  },
};
