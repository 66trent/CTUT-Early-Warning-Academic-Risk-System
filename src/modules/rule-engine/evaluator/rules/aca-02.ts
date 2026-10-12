import { z } from 'zod';
import { CourseResultStatus, RuleGroup, Severity } from '@/db/enums';
import { maxSeverity, severitySchema } from '../helpers';
import { type StudentRule } from '../types';

const conditionSchema = z.object({
  bands: z
    .array(z.object({ minFailed: z.number().int().min(1).max(20), severity: severitySchema }))
    .min(1),
});
export type Aca02Condition = z.infer<typeof conditionSchema>;

/** ACA-02 — Rớt học phần trong học kỳ (docs/rules/08), theo sinh viên × học kỳ. */
export const aca02: StudentRule<Aca02Condition> = {
  kind: 'PER_STUDENT',
  meta: {
    ruleCode: 'ACA-02',
    ruleName: 'Rớt học phần trong học kỳ',
    ruleGroup: RuleGroup.ACADEMIC,
    scope: 'PER_STUDENT',
    priority: 70,
    requires: null,
  },
  conditionSchema,
  defaultCondition: {
    bands: [
      { minFailed: 1, severity: Severity.HIGH },
      { minFailed: 2, severity: Severity.CRITICAL },
    ],
  },
  maxSeverity: (c) => maxSeverity(c.bands.map((b) => b.severity)) ?? Severity.CRITICAL,

  evaluate(facts, c) {
    const failed = facts.filter(
      (f) => f.result?.resultStatus === CourseResultStatus.FINAL && f.result.passed === false,
    );
    const severity = maxSeverity(
      c.bands.filter((b) => failed.length >= b.minFailed).map((b) => b.severity),
    );
    if (!severity) return { hit: null };
    return {
      hit: {
        severity,
        reason: `Rớt ${failed.length} học phần trong học kỳ: ${failed
          .map((f) => `${f.input.courseName} (${f.input.courseId})`)
          .join(', ')}.`,
        inputSnapshot: {
          failedCount: failed.length,
          failedCourses: failed.map((f) => f.input.courseId).join(','),
        },
      },
    };
  },
};
