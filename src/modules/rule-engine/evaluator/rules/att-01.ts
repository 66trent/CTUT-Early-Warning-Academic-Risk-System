import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { formatPercent, maxSeverity, severitySchema, vnDateKey } from '../helpers';
import { type CourseRule } from '../types';

/** Dải phần trăm nguyên; `gt` = vượt quá (VD > 20%). Dùng chung cho ATT-01, ACA-02. */
export const percentBandsSchema = z
  .array(
    z.object({
      percent: z.number().int().min(1).max(100),
      op: z.enum(['gte', 'gt']),
      severity: severitySchema,
    }),
  )
  .min(1);

/** Mức cao nhất khớp `part / whole` theo dải — so sánh số nguyên `part × 100` với `% × whole`. */
export function matchPercentBands(
  bands: z.infer<typeof percentBandsSchema>,
  part: number,
  whole: number,
): { severity: Severity | null; exceeded: number | null } {
  const matched = bands.filter((b) =>
    b.op === 'gt' ? part * 100 > b.percent * whole : part * 100 >= b.percent * whole,
  );
  const severity = maxSeverity(matched.map((b) => b.severity));
  const top = matched.find((b) => b.op === 'gt' && b.severity === severity);
  return { severity, exceeded: top?.percent ?? null };
}

const conditionSchema = z.object({
  /** Tính cả tiết vắng có phép (quy chế: có phép và không phép đều tính). */
  countExcused: z.boolean(),
  bands: percentBandsSchema,
});
export type Att01Condition = z.infer<typeof conditionSchema>;

/**
 * ATT-01 — Vắng gần ngưỡng cấm thi (docs/rules/08): tiết vắng / tổng số tiết của học phần.
 * Hệ thống CHỈ cảnh báo, KHÔNG ghi điểm F / cấm thi. So sánh bằng số nguyên.
 */
export const att01: CourseRule<Att01Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  appliesTo: 'REGISTERED',
  meta: {
    ruleCode: 'ATT-01',
    ruleName: 'Vắng gần ngưỡng cấm thi',
    ruleGroup: RuleGroup.ATTENDANCE,
    scope: 'PER_COURSE',
    priority: 10,
    signal: 'ATTENDANCE',
    requires: 'ATTENDANCE',
  },
  conditionSchema,
  defaultCondition: {
    countExcused: true,
    bands: [
      { percent: 10, op: 'gte', severity: Severity.MEDIUM },
      { percent: 15, op: 'gte', severity: Severity.HIGH },
      { percent: 20, op: 'gt', severity: Severity.CRITICAL },
    ],
  },
  maxSeverity: (c) => maxSeverity(c.bands.map((b) => b.severity)) ?? Severity.CRITICAL,

  evaluate({ facts }, c) {
    const s = facts.attendance.latest;
    if (!s || s.totalPeriods <= 0) return { hit: null };
    const absences = s.unexcusedAbsence + (c.countExcused ? s.excusedAbsence : 0);
    const { severity, exceeded } = matchPercentBands(c.bands, absences, s.totalPeriods);
    if (!severity) return { hit: null };
    const rate = absences / s.totalPeriods;
    return {
      hit: {
        severity,
        reason:
          `Vắng ${absences}/${s.totalPeriods} tiết (${formatPercent(rate)})` +
          (exceeded ? ` — đã vượt ngưỡng cấm thi ${exceeded}%.` : '.'),
        inputSnapshot: {
          snapshotDate: vnDateKey(s.snapshotDate),
          absences,
          excusedAbsence: s.excusedAbsence,
          unexcusedAbsence: s.unexcusedAbsence,
          totalPeriods: s.totalPeriods,
          rate,
        },
      },
    };
  },
};
