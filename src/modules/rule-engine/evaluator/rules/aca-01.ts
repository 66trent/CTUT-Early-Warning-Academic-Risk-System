import { z } from 'zod';
import { CourseResultStatus, RuleGroup, Severity } from '@/db/enums';
import { formatNumber, severitySchema, tenths, vnDateKey } from '../helpers';
import { type CourseRule } from '../types';

const conditionSchema = z.object({
  /** Điểm quá trình (thang 10) dưới mức này thì kích hoạt — `< threshold`. */
  threshold: z.number().gt(0).max(10),
  severity: severitySchema,
});
export type Aca01Condition = z.infer<typeof conditionSchema>;

/**
 * ACA-01 — Điểm quá trình thấp, trước kỳ thi (docs/rules/08). Chỉ xét `PROCESS_ONLY`;
 * khi kết quả chuyển FINAL, luật không xét nữa. So sánh theo phần mười (số nguyên).
 */
export const aca01: CourseRule<Aca01Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  meta: {
    ruleCode: 'ACA-01',
    ruleName: 'Điểm quá trình thấp',
    ruleGroup: RuleGroup.ACADEMIC,
    scope: 'PER_COURSE',
    priority: 60,
    requires: null,
  },
  conditionSchema,
  defaultCondition: { threshold: 5, severity: Severity.HIGH },
  maxSeverity: (c) => c.severity,

  evaluate({ facts }, c) {
    const r = facts.result;
    if (r?.resultStatus !== CourseResultStatus.PROCESS_ONLY || r.processScore === null) {
      return { hit: null };
    }
    if (tenths(r.processScore) >= tenths(c.threshold)) return { hit: null };
    return {
      hit: {
        severity: c.severity,
        reason: `Điểm quá trình ${formatNumber(r.processScore, 1)} dưới ${formatNumber(c.threshold, 1)} (công bố ${vnDateKey(r.publishedAt)}).`,
        inputSnapshot: {
          processScore: r.processScore,
          threshold: c.threshold,
          publishedAt: vnDateKey(r.publishedAt),
        },
      },
    };
  },
};
