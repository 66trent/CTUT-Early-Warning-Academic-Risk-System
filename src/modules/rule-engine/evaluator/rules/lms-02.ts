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
 * LMS-02 — Điểm trắc nghiệm thấp (docs/rules/08): N bài đến hạn gần nhất mà sinh viên đã nộp,
 * điểm mỗi bài = lượt cao nhất. Lượt không có thang điểm (`maxScore` NULL) bị bỏ qua + cảnh báo.
 * Số câu đúng chỉ hiển thị, không dùng để cảnh báo.
 */
export const lms02: CourseRule<Lms02Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  appliesTo: 'REGISTERED',
  meta: {
    ruleCode: 'LMS-02',
    ruleName: 'Điểm trắc nghiệm thấp',
    ruleGroup: RuleGroup.LMS,
    scope: 'PER_COURSE',
    priority: 50,
    signal: 'QUIZ',
    requires: 'LMS_QUIZ',
  },
  conditionSchema,
  defaultCondition: { recentCount: 2, thresholdPercent: 50, severity: Severity.MEDIUM },
  maxSeverity: (c) => c.severity,

  evaluate({ facts }, c) {
    const warnings: DataWarning[] = [];
    const best = new Map<string, { score: number; maxScore: number }>();
    for (const a of facts.quiz.attempts) {
      if (a.status !== QuizAttemptStatus.SUBMITTED || a.score === null) continue;
      if (a.maxScore === null) {
        warnings.push({
          code: 'QUIZ_MAX_SCORE_MISSING',
          courseId: facts.input.courseId,
          message: `Một lượt làm bài trắc nghiệm (lần ${a.attemptNumber}) thiếu điểm tối đa — bỏ qua khi xét điểm thấp.`,
        });
        continue;
      }
      const current = best.get(a.activityId);
      if (!current || a.score / a.maxScore > current.score / current.maxScore) {
        best.set(a.activityId, { score: a.score, maxScore: a.maxScore });
      }
    }
    const recent = [...facts.quiz.dueQuizzes]
      .sort((a, b) => b.orderAt.getTime() - a.orderAt.getTime())
      .filter((q) => best.has(q.activityId))
      .slice(0, c.recentCount)
      .map((q) => ({ quiz: q, ...(best.get(q.activityId) ?? { score: 0, maxScore: 1 }) }));
    if (recent.length < c.recentCount) return { hit: null, warnings };
    const allLow = recent.every((r) => r.score * 100 < c.thresholdPercent * r.maxScore);
    if (!allLow) return { hit: null, warnings };
    return {
      hit: {
        severity: c.severity,
        reason: `${recent.length} bài trắc nghiệm gần nhất đều dưới ${c.thresholdPercent}% điểm: ${recent
          .map((r) => `${r.quiz.quizName} ${formatNumber(r.score)}/${formatNumber(r.maxScore)}`)
          .join(', ')} (lấy lượt cao nhất).`,
        inputSnapshot: Object.fromEntries(
          recent.flatMap((r, i): [string, SnapshotValue][] => [
            [`quiz${i + 1}`, r.quiz.quizName],
            [`score${i + 1}`, r.score],
            [`maxScore${i + 1}`, r.maxScore],
          ]),
        ),
      },
      warnings,
    };
  },
};
