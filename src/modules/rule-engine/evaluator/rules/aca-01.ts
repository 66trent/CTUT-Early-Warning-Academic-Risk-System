import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { formatVnDate, severitySchema, vnDateKey } from '../helpers';
import { type CourseRule } from '../types';

const conditionSchema = z.object({ severity: severitySchema });
export type Aca01Condition = z.infer<typeof conditionSchema>;

/**
 * ACA-01 — Không đạt học phần (docs/rules/08): xét Enrollment đã có kết quả (`COMPLETED`) — báo
 * ngay khi học phần khóa điểm, không chờ hết học kỳ. Lý do nêu "không được dự thi" / "vắng thi".
 */
export const aca01: CourseRule<Aca01Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  appliesTo: 'COMPLETED',
  meta: {
    ruleCode: 'ACA-01',
    ruleName: 'Không đạt học phần',
    ruleGroup: RuleGroup.ACADEMIC,
    scope: 'PER_COURSE',
    priority: 60,
    signal: 'ACADEMIC',
    requires: null,
  },
  conditionSchema,
  defaultCondition: { severity: Severity.HIGH },
  maxSeverity: (c) => c.severity,

  evaluate({ facts }, c) {
    const r = facts.result;
    if (!r || r.passed) return { hit: null };
    const cause =
      r.eligibleForExam === false ? ' — không được dự thi' : r.absentFromExam ? ' — vắng thi' : '';
    return {
      hit: {
        severity: c.severity,
        reason: `Không đạt học phần: điểm ${r.letterGrade}${cause} (công bố ${formatVnDate(r.publishedAt)}).`,
        inputSnapshot: {
          letterGrade: r.letterGrade,
          eligibleForExam: r.eligibleForExam,
          absentFromExam: r.absentFromExam,
          publishedAt: vnDateKey(r.publishedAt),
        },
      },
    };
  },
};
