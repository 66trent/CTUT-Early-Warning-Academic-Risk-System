import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { formatVnDate, maxSeverity } from '../helpers';
import { type CourseRule, type EnrollmentFacts } from '../types';
import { countBandsSchema, matchCountBands } from './lms-01';

const conditionSchema = z.object({ bands: countBandsSchema });
export type Lms03Condition = z.infer<typeof conditionSchema>;

/** Bài thực hành đã quá hạn mà sinh viên chưa nộp (tại asOf). */
export function missingAssignments(facts: EnrollmentFacts) {
  return facts.assignment.dueAssignments.filter(
    (a) => !facts.assignment.submittedAt.has(a.activityId),
  );
}

/**
 * LMS-03 — Không nộp bài thực hành (docs/rules/08): chỉ dựa trạng thái nộp (giảng viên có thể
 * chưa chấm điểm). Bài chưa đến hạn không xét.
 */
export const lms03: CourseRule<Lms03Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  appliesTo: 'REGISTERED',
  meta: {
    ruleCode: 'LMS-03',
    ruleName: 'Không nộp bài thực hành',
    ruleGroup: RuleGroup.LMS,
    scope: 'PER_COURSE',
    priority: 55,
    signal: 'ASSIGNMENT',
    requires: 'LMS_ASSIGNMENT',
  },
  conditionSchema,
  defaultCondition: {
    bands: [
      { minCount: 1, severity: Severity.MEDIUM },
      { minCount: 2, severity: Severity.HIGH },
    ],
  },
  maxSeverity: (c) => maxSeverity(c.bands.map((b) => b.severity)) ?? Severity.HIGH,

  evaluate({ facts }, c) {
    const missing = missingAssignments(facts);
    const severity = matchCountBands(c.bands, missing.length);
    if (!severity) return { hit: null };
    return {
      hit: {
        severity,
        reason: `Không nộp ${missing.length}/${facts.assignment.dueAssignments.length} bài thực hành đã quá hạn: ${missing
          .map((a) => `${a.name} (hạn ${formatVnDate(a.dueAt)})`)
          .join(', ')}.`,
        inputSnapshot: {
          missingCount: missing.length,
          dueCount: facts.assignment.dueAssignments.length,
          missingAssignments: missing.map((a) => a.name).join(', '),
        },
      },
    };
  },
};
