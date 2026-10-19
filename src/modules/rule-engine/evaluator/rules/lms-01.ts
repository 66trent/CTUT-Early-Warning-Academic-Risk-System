import { z } from 'zod';
import { QuizAttemptStatus, RuleGroup, Severity } from '@/db/enums';
import { maxSeverity, severitySchema } from '../helpers';
import { type CourseRule, type EnrollmentFacts } from '../types';

/** Dải theo số bài bị bỏ; lấy dải cao nhất khớp. Dùng chung cho LMS-01, LMS-03. */
export const countBandsSchema = z
  .array(z.object({ minCount: z.number().int().min(1).max(50), severity: severitySchema }))
  .min(1);

export function matchCountBands(bands: z.infer<typeof countBandsSchema>, count: number) {
  return maxSeverity(bands.filter((b) => count >= b.minCount).map((b) => b.severity));
}

const conditionSchema = z.object({ bands: countBandsSchema });
export type Lms01Condition = z.infer<typeof conditionSchema>;

/** Bài trắc nghiệm đến hạn mà sinh viên chưa có lượt SUBMITTED (tại asOf). */
export function missedDueQuizzes(facts: EnrollmentFacts) {
  const submitted = new Set(
    facts.quiz.attempts
      .filter((a) => a.status === QuizAttemptStatus.SUBMITTED)
      .map((a) => a.activityId),
  );
  return facts.quiz.dueQuizzes.filter((q) => !submitted.has(q.activityId));
}

/**
 * LMS-01 — Bỏ bài trắc nghiệm (docs/rules/08). "Đến hạn" theo hạn nộp; bài không có hạn nộp
 * dùng cách dự phòng theo lớp (xem `lms-groups.ts`).
 */
export const lms01: CourseRule<Lms01Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  appliesTo: 'REGISTERED',
  meta: {
    ruleCode: 'LMS-01',
    ruleName: 'Bỏ bài trắc nghiệm',
    ruleGroup: RuleGroup.LMS,
    scope: 'PER_COURSE',
    priority: 40,
    signal: 'QUIZ',
    requires: 'LMS_QUIZ',
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
    const missed = missedDueQuizzes(facts);
    const severity = matchCountBands(c.bands, missed.length);
    if (!severity) return { hit: null };
    return {
      hit: {
        severity,
        reason: `Bỏ ${missed.length}/${facts.quiz.dueQuizzes.length} bài trắc nghiệm đã đến hạn: ${missed.map((q) => q.quizName).join(', ')}.`,
        inputSnapshot: {
          missedCount: missed.length,
          dueCount: facts.quiz.dueQuizzes.length,
          missedQuizzes: missed.map((q) => q.quizName).join(', '),
        },
      },
    };
  },
};
