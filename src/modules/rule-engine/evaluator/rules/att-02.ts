import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { DAY_MS, formatVnDate, severitySchema, vnDateKey } from '../helpers';
import { type CourseRule } from '../types';

const conditionSchema = z.object({
  /** Chỉ so 2 snapshot cách nhau không quá số ngày này. */
  windowDays: z.number().int().min(1).max(60),
  minIncrease: z.number().int().min(1).max(50),
  severity: severitySchema,
});
export type Att02Condition = z.infer<typeof conditionSchema>;

/**
 * ATT-02 — Vắng tăng nhanh (docs/rules/08): so snapshot mới nhất với snapshot liền trước.
 * Số vắng giảm (dữ liệu bị sửa) → không kích hoạt, ghi cảnh báo chất lượng dữ liệu.
 */
export const att02: CourseRule<Att02Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  meta: {
    ruleCode: 'ATT-02',
    ruleName: 'Vắng tăng nhanh',
    ruleGroup: RuleGroup.ATTENDANCE,
    scope: 'PER_COURSE',
    priority: 20,
    requires: 'ATTENDANCE',
  },
  conditionSchema,
  defaultCondition: { windowDays: 14, minIncrease: 2, severity: Severity.HIGH },
  maxSeverity: (c) => c.severity,

  evaluate({ facts }, c) {
    const { latest: s2, previous: s1 } = facts.attendance;
    if (!s2 || !s1) return { hit: null };
    const days = (s2.snapshotDate.getTime() - s1.snapshotDate.getTime()) / DAY_MS;
    if (days > c.windowDays) return { hit: null };
    const increase = s2.unexcusedAbsence - s1.unexcusedAbsence;
    if (increase < 0) {
      return {
        hit: null,
        warnings: [
          {
            code: 'ATTENDANCE_DECREASED',
            courseId: facts.input.courseId,
            message: `Số buổi vắng không phép giảm từ ${s1.unexcusedAbsence} (${formatVnDate(s1.snapshotDate)}) xuống ${s2.unexcusedAbsence} (${formatVnDate(s2.snapshotDate)}) — dữ liệu nguồn có thể đã bị sửa.`,
          },
        ],
      };
    }
    if (increase < c.minIncrease) return { hit: null };
    return {
      hit: {
        severity: c.severity,
        reason: `Vắng không phép tăng ${increase} buổi trong ${days} ngày: ${s1.unexcusedAbsence} (${formatVnDate(s1.snapshotDate)}) → ${s2.unexcusedAbsence} (${formatVnDate(s2.snapshotDate)}).`,
        inputSnapshot: {
          previousDate: vnDateKey(s1.snapshotDate),
          previousUnexcused: s1.unexcusedAbsence,
          latestDate: vnDateKey(s2.snapshotDate),
          latestUnexcused: s2.unexcusedAbsence,
          increase,
          days,
        },
      },
    };
  },
};
