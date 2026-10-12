import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { formatPercent, maxSeverity, severitySchema, vnDateKey } from '../helpers';
import { type CourseRule } from '../types';

const conditionSchema = z.object({
  /** PLANNED = tổng buổi theo kế hoạch (đúng quy chế); HELD = số buổi đã học. */
  denominator: z.enum(['PLANNED', 'HELD']),
  countExcused: z.boolean(),
  /** N > 0: mỗi N lần đi trễ tính 1 buổi vắng; 0 = không quy đổi. */
  lateToAbsenceRatio: z.number().int().min(0).max(10),
  minSessions: z.number().int().min(1).max(100),
  /** Dải theo phần trăm nguyên; lấy dải cao nhất khớp. `gt` = vượt quá (VD > 20%). */
  bands: z
    .array(
      z.object({
        percent: z.number().int().min(1).max(100),
        op: z.enum(['gte', 'gt']),
        severity: severitySchema,
      }),
    )
    .min(1),
});
export type Att01Condition = z.infer<typeof conditionSchema>;

/**
 * ATT-01 — Tỷ lệ vắng so với ngưỡng cấm thi (docs/rules/08). Hệ thống CHỈ cảnh báo,
 * KHÔNG ghi điểm F / cấm thi. So sánh bằng số nguyên: `vắng × 100` với `% × mẫu số`.
 */
export const att01: CourseRule<Att01Condition> = {
  kind: 'PER_COURSE',
  stage: 'BASE',
  meta: {
    ruleCode: 'ATT-01',
    ruleName: 'Tỷ lệ vắng so với ngưỡng cấm thi',
    ruleGroup: RuleGroup.ATTENDANCE,
    scope: 'PER_COURSE',
    priority: 10,
    requires: 'ATTENDANCE',
  },
  conditionSchema,
  defaultCondition: {
    denominator: 'PLANNED',
    countExcused: true,
    lateToAbsenceRatio: 0,
    minSessions: 4,
    bands: [
      { percent: 10, op: 'gte', severity: Severity.MEDIUM },
      { percent: 15, op: 'gte', severity: Severity.HIGH },
      { percent: 20, op: 'gt', severity: Severity.CRITICAL },
    ],
  },
  maxSeverity: (c) => maxSeverity(c.bands.map((b) => b.severity)) ?? Severity.CRITICAL,

  evaluate({ facts }, c) {
    const s = facts.attendance.latest;
    if (!s || s.totalSessions < c.minSessions) return { hit: null };
    const usePlanned = c.denominator === 'PLANNED' && s.plannedSessions !== null;
    const denominator = usePlanned ? (s.plannedSessions ?? 0) : s.totalSessions;
    if (denominator <= 0) return { hit: null };
    const lateAsAbsence = c.lateToAbsenceRatio > 0 ? Math.floor(s.late / c.lateToAbsenceRatio) : 0;
    const absences = s.unexcusedAbsence + (c.countExcused ? s.excusedAbsence : 0) + lateAsAbsence;
    const matched = c.bands
      .filter((b) =>
        b.op === 'gt'
          ? absences * 100 > b.percent * denominator
          : absences * 100 >= b.percent * denominator,
      )
      .map((b) => b.severity);
    const severity = maxSeverity(matched);
    if (!severity) return { hit: null };

    const rate = absences / denominator;
    const top = c.bands.find((b) => b.op === 'gt' && b.severity === severity);
    const basis = usePlanned
      ? 'buổi theo kế hoạch'
      : c.denominator === 'PLANNED'
        ? 'buổi đã học (nguồn không có số buổi kế hoạch)'
        : 'buổi đã học';
    return {
      hit: {
        severity,
        reason:
          `Vắng ${absences}/${denominator} ${basis} (${formatPercent(rate)})` +
          (top ? ` — đã vượt ngưỡng cấm thi ${top.percent}%.` : '.'),
        inputSnapshot: {
          snapshotDate: vnDateKey(s.snapshotDate),
          absences,
          excusedAbsence: s.excusedAbsence,
          unexcusedAbsence: s.unexcusedAbsence,
          late: s.late,
          denominator,
          denominatorType: usePlanned ? 'PLANNED' : 'HELD',
          totalSessions: s.totalSessions,
          rate,
        },
      },
    };
  },
};
