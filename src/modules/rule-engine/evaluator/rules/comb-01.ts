import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { severityRank, severitySchema } from '../helpers';
import { SEVERITY_LABELS } from '@/lib/labels';
import { type CourseRule, type SignalSource } from '../types';

const conditionSchema = z.object({
  /** Số nguồn (điểm danh, trắc nghiệm, thực hành) cùng có trigger ≥ `minSeverity`. */
  minGroups: z.number().int().min(2).max(3),
  minSeverity: severitySchema,
  severity: severitySchema,
});
export type Comb01Condition = z.infer<typeof conditionSchema>;

const SOURCES: readonly SignalSource[] = ['ATTENDANCE', 'QUIZ', 'ASSIGNMENT'];

/**
 * COMB-01 — Nhiều nguồn cùng xấu (docs/rules/08): điểm danh · trắc nghiệm · thực hành. Chạy sau
 * các luật BASE, cùng Enrollment.
 */
export const comb01: CourseRule<Comb01Condition> = {
  kind: 'PER_COURSE',
  stage: 'COMBINED',
  appliesTo: 'REGISTERED',
  meta: {
    ruleCode: 'COMB-01',
    ruleName: 'Nhiều nguồn cùng xấu',
    ruleGroup: RuleGroup.COMBINED,
    scope: 'PER_COURSE',
    priority: 90,
    signal: null,
    requires: null,
  },
  conditionSchema,
  defaultCondition: { minGroups: 2, minSeverity: Severity.MEDIUM, severity: Severity.CRITICAL },
  maxSeverity: (c) => c.severity,

  evaluate({ priorHits }, c) {
    const strong = priorHits.filter(
      (h) =>
        h.signal !== null &&
        SOURCES.includes(h.signal) &&
        severityRank(h.severity) >= severityRank(c.minSeverity),
    );
    const groups = [...new Set(strong.map((h) => h.signal))];
    if (groups.length < c.minGroups) return { hit: null };
    return {
      hit: {
        severity: c.severity,
        reason: `${groups.length} nguồn dữ liệu cùng có dấu hiệu từ mức ${SEVERITY_LABELS[c.minSeverity]} trở lên: ${strong
          .map((h) => `${h.ruleCode} (${SEVERITY_LABELS[h.severity]})`)
          .join(', ')}.`,
        inputSnapshot: {
          groups: groups.join(','),
          rules: strong.map((h) => `${h.ruleCode}:${h.severity}`).join(','),
        },
      },
    };
  },
};
