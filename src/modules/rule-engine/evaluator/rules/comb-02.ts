import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { bumpSeverity, maxSeverity, severityRank, severitySchema } from '../helpers';
import { SEVERITY_LABELS } from '@/lib/labels';
import { type CourseRule } from '../types';

const conditionSchema = z.object({
  /** Lần học từ mức này trở lên (đã rớt học phần ở học kỳ trước). */
  minAttempt: z.number().int().min(2).max(10),
  minSeverity: severitySchema,
  /** Số bậc nâng so với mức cao nhất của trigger điểm danh/LMS. */
  bump: z.number().int().min(1).max(3),
});
export type Comb02Condition = z.infer<typeof conditionSchema>;

const TRIGGER_GROUPS: readonly RuleGroup[] = [RuleGroup.ATTENDANCE, RuleGroup.LMS];

/**
 * COMB-02 — Học lại vẫn sa sút (docs/rules/08): lần học ≥ 2 (tính theo asOf) VÀ có trigger
 * ATT-x hoặc LMS-x ≥ MEDIUM → mức cao nhất đó + 1 bậc (tối đa CRITICAL). Lý do nêu học kỳ đã rớt.
 */
export const comb02: CourseRule<Comb02Condition> = {
  kind: 'PER_COURSE',
  stage: 'COMBINED',
  appliesTo: 'REGISTERED',
  meta: {
    ruleCode: 'COMB-02',
    ruleName: 'Học lại vẫn sa sút',
    ruleGroup: RuleGroup.COMBINED,
    scope: 'PER_COURSE',
    priority: 100,
    signal: null,
    requires: null,
  },
  conditionSchema,
  defaultCondition: { minAttempt: 2, minSeverity: Severity.MEDIUM, bump: 1 },
  maxSeverity: () => Severity.CRITICAL,

  evaluate({ facts, priorHits }, c) {
    if (facts.attemptNumber < c.minAttempt) return { hit: null };
    const signals = priorHits.filter(
      (h) =>
        TRIGGER_GROUPS.includes(h.ruleGroup) &&
        severityRank(h.severity) >= severityRank(c.minSeverity),
    );
    const highest = maxSeverity(signals.map((h) => h.severity));
    if (!highest) return { hit: null };
    const failedIn = facts.failedTerms.map((t) => t.termName).join(', ');
    return {
      hit: {
        severity: bumpSeverity(highest, c.bump),
        reason: `Đang học lại lần ${facts.attemptNumber} (đã rớt ở ${failedIn}) và vẫn có dấu hiệu sa sút: ${signals
          .map((h) => `${h.ruleCode} (${SEVERITY_LABELS[h.severity]})`)
          .join(', ')}.`,
        inputSnapshot: {
          attemptNumber: facts.attemptNumber,
          failedTerms: facts.failedTerms.map((t) => t.termId).join(','),
          signals: signals.map((h) => `${h.ruleCode}:${h.severity}`).join(','),
        },
      },
    };
  },
};
