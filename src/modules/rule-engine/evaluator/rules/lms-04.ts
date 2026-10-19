import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { severitySchema } from '../helpers';
import { type CourseRule, type EnrollmentFacts } from '../types';

const conditionSchema = z.object({
  /** Số bài nộp trễ trong 1 học phần từ mức này trở lên. */
  minLate: z.number().int().min(1).max(50),
  severity: severitySchema,
});
export type Lms04Condition = z.infer<typeof conditionSchema>;

/** Bài thực hành đã nộp (tại asOf) sau hạn nộp. */
export function lateAssignments(facts: EnrollmentFacts): number {
  let late = 0;
  for (const [activityId, submittedAt] of facts.assignment.submittedAt) {
    const dueAt = facts.assignment.dueAt.get(activityId);
    if (dueAt && submittedAt > dueAt) late += 1;
  }
  return late;
}

/** LMS-04 — Nộp trễ nhiều (docs/rules/08): nhắc nhẹ, mặc định LOW (chỉ trong ứng dụng). */
export const lms04: CourseRule<Lms04Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  appliesTo: 'REGISTERED',
  meta: {
    ruleCode: 'LMS-04',
    ruleName: 'Nộp trễ bài thực hành nhiều',
    ruleGroup: RuleGroup.LMS,
    scope: 'PER_COURSE',
    priority: 57,
    signal: 'ASSIGNMENT',
    requires: 'LMS_ASSIGNMENT',
  },
  conditionSchema,
  defaultCondition: { minLate: 2, severity: Severity.LOW },
  maxSeverity: (c) => c.severity,

  evaluate({ facts }, c) {
    const late = lateAssignments(facts);
    if (late < c.minLate) return { hit: null };
    return {
      hit: {
        severity: c.severity,
        reason: `Nộp trễ ${late} bài thực hành.`,
        inputSnapshot: { lateCount: late },
      },
    };
  },
};
