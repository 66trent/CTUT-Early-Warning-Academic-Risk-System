import { z } from 'zod';
import { QuizAttemptStatus, RuleGroup, Severity } from '@/db/enums';
import { maxSeverity, severitySchema } from '../helpers';
import { type CourseRule, type EnrollmentFacts } from '../types';

const conditionSchema = z.object({
  /** Dải theo số bài đến hạn bị bỏ; lấy dải cao nhất khớp. */
  bands: z
    .array(z.object({ minMissed: z.number().int().min(1).max(50), severity: severitySchema }))
    .min(1),
});
export type Lms01Condition = z.infer<typeof conditionSchema>;

/** Bài đến hạn mà sinh viên chưa có lượt SUBMITTED. */
export function missedDueQuizzes(facts: EnrollmentFacts) {
  const submitted = new Set(
    facts.lms.attempts
      .filter((a) => a.status === QuizAttemptStatus.SUBMITTED)
      .map((a) => a.quizKey),
  );
  return facts.lms.dueQuizzes.filter((q) => !submitted.has(q.quizKey));
}

/**
 * LMS-01 — Bỏ bài kiểm tra (docs/rules/08). "Đến hạn" tính theo nhóm (xem `lms-groups.ts`);
 * chỉ bắt được bài đa số lớp đã làm (giới hạn đã biết — không có danh sách bài từ LMS).
 */
export const lms01: CourseRule<Lms01Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  meta: {
    ruleCode: 'LMS-01',
    ruleName: 'Bỏ bài kiểm tra',
    ruleGroup: RuleGroup.LMS,
    scope: 'PER_COURSE',
    priority: 40,
    requires: 'LMS',
  },
  conditionSchema,
  defaultCondition: {
    bands: [
      { minMissed: 1, severity: Severity.MEDIUM },
      { minMissed: 2, severity: Severity.HIGH },
    ],
  },
  maxSeverity: (c) => maxSeverity(c.bands.map((b) => b.severity)) ?? Severity.HIGH,

  evaluate({ facts }, c) {
    const missed = missedDueQuizzes(facts);
    const severity = maxSeverity(
      c.bands.filter((b) => missed.length >= b.minMissed).map((b) => b.severity),
    );
    if (!severity) return { hit: null };
    return {
      hit: {
        severity,
        reason: `Bỏ ${missed.length}/${facts.lms.dueQuizzes.length} bài kiểm tra đã đến hạn: ${missed.map((q) => q.quizName).join(', ')}.`,
        inputSnapshot: {
          missedCount: missed.length,
          dueCount: facts.lms.dueQuizzes.length,
          missedQuizzes: missed.map((q) => q.quizKey).join(','),
        },
      },
    };
  },
};
