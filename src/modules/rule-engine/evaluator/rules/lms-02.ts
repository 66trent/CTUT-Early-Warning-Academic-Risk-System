import { z } from 'zod';
import { QuizAttemptStatus, RuleGroup, Severity } from '@/db/enums';
import { formatNumber, severitySchema } from '../helpers';
import { type CourseRule, type DataWarning, type SnapshotValue } from '../types';

const conditionSchema = z.object({
  /** Số bài đến hạn gần nhất (đã nộp) cần xét. */
  recentCount: z.number().int().min(1).max(10),
  /** Ngưỡng điểm theo % thang điểm của bài: `score / maxScore < %`. */
  thresholdPercent: z.number().int().min(1).max(100),
  severity: severitySchema,
});
export type Lms02Condition = z.infer<typeof conditionSchema>;

/**
 * LMS-02 — Điểm kiểm tra thấp (docs/rules/08): N bài đến hạn gần nhất mà sinh viên đã nộp,
 * điểm mỗi bài = lượt cao nhất. Lượt không có thang điểm (`maxScore` NULL) bị bỏ qua + cảnh báo.
 */
export const lms02: CourseRule<Lms02Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  meta: {
    ruleCode: 'LMS-02',
    ruleName: 'Điểm kiểm tra thấp',
    ruleGroup: RuleGroup.LMS,
    scope: 'PER_COURSE',
    priority: 50,
    requires: 'LMS',
  },
  conditionSchema,
  defaultCondition: { recentCount: 2, thresholdPercent: 50, severity: Severity.MEDIUM },
  maxSeverity: (c) => c.severity,

  evaluate({ facts }, c) {
    const warnings: DataWarning[] = [];
    const best = new Map<string, { score: number; maxScore: number }>();
    for (const a of facts.lms.attempts) {
      if (a.status !== QuizAttemptStatus.SUBMITTED || a.score === null) continue;
      if (a.maxScore === null) {
        warnings.push({
          code: 'QUIZ_MAX_SCORE_MISSING',
          courseId: facts.input.courseId,
          message: `Bài ${a.quizName} lần ${a.attemptNumber} thiếu điểm tối đa — bỏ qua khi xét điểm thấp.`,
        });
        continue;
      }
      const current = best.get(a.quizKey);
      if (!current || a.score / a.maxScore > current.score / current.maxScore) {
        best.set(a.quizKey, { score: a.score, maxScore: a.maxScore });
      }
    }
    const recent = [...facts.lms.dueQuizzes]
      .sort((a, b) => b.firstStartedAt.getTime() - a.firstStartedAt.getTime())
      .filter((q) => best.has(q.quizKey))
      .slice(0, c.recentCount)
      .map((q) => ({ quiz: q, ...(best.get(q.quizKey) ?? { score: 0, maxScore: 1 }) }));
    if (recent.length < c.recentCount) return { hit: null, warnings };
    const allLow = recent.every((r) => r.score * 100 < c.thresholdPercent * r.maxScore);
    if (!allLow) return { hit: null, warnings };
    return {
      hit: {
        severity: c.severity,
        reason: `${recent.length} bài kiểm tra gần nhất đều dưới ${c.thresholdPercent}% điểm: ${recent
          .map((r) => `${r.quiz.quizName} ${formatNumber(r.score)}/${formatNumber(r.maxScore)}`)
          .join(', ')} (lấy lượt cao nhất).`,
        inputSnapshot: Object.fromEntries(
          recent.flatMap((r, i): [string, SnapshotValue][] => [
            [`quiz${i + 1}`, r.quiz.quizKey],
            [`score${i + 1}`, r.score],
            [`maxScore${i + 1}`, r.maxScore],
          ]),
        ),
      },
      warnings,
    };
  },
};
