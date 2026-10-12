import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { severitySchema, vnDateKey } from '../helpers';
import { type CourseRule } from '../types';

const conditionSchema = z.object({
  minLate: z.number().int().min(1).max(100),
  severity: severitySchema,
});
export type Att03Condition = z.infer<typeof conditionSchema>;

/** ATT-03 — Đi trễ nhiều (docs/rules/08). Mức LOW: chỉ hiển thị trong ứng dụng, không email. */
export const att03: CourseRule<Att03Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  meta: {
    ruleCode: 'ATT-03',
    ruleName: 'Đi trễ nhiều',
    ruleGroup: RuleGroup.ATTENDANCE,
    scope: 'PER_COURSE',
    priority: 30,
    requires: 'ATTENDANCE',
  },
  conditionSchema,
  defaultCondition: { minLate: 3, severity: Severity.LOW },
  maxSeverity: (c) => c.severity,

  evaluate({ facts }, c) {
    const s = facts.attendance.latest;
    if (!s || s.late < c.minLate) return { hit: null };
    return {
      hit: {
        severity: c.severity,
        reason: `Đi trễ ${s.late} buổi (tính đến ${s.totalSessions} buổi đã học).`,
        inputSnapshot: {
          snapshotDate: vnDateKey(s.snapshotDate),
          late: s.late,
          totalSessions: s.totalSessions,
        },
      },
    };
  },
};
