import { z } from 'zod';
import { RuleGroup, Severity } from '@/db/enums';
import { gpaValue, type TermAcademics, termAcademics, termResults } from '../academic';
import { formatNumber, maxSeverity, severityRank, severitySchema } from '../helpers';
import { type StudentRule, type StudentRuleContext } from '../types';
import { aca02, assessFailedCredits } from './aca-02';
import { aca03, assessGpa } from './aca-03';

const conditionSchema = z.object({
  /** ĐTB học kỳ này thấp hơn học kỳ liền trước từ mức này trở lên. */
  minDrop: z.number().gt(0).max(4),
  dropSeverity: severitySchema,
  /** Cả 2 học kỳ liên tiếp có mức ACA-02 hoặc ACA-03 từ mức này trở lên. */
  consecutiveMinSeverity: severitySchema,
  consecutiveSeverity: severitySchema,
});
export type Aca04Condition = z.infer<typeof conditionSchema>;

/** Mức cao nhất của ACA-02 / ACA-03 cho 1 học kỳ — tính lại TỪ DỮ LIỆU với `condition` ACTIVE. */
function termLevel(ctx: StudentRuleContext, academics: TermAcademics, isFirstTerm: boolean) {
  const aca02Condition = aca02.conditionSchema.safeParse(ctx.conditionOf('ACA-02'));
  const aca03Condition = aca03.conditionSchema.safeParse(ctx.conditionOf('ACA-03'));
  return maxSeverity(
    [
      ...(aca02Condition.success
        ? [assessFailedCredits(academics, aca02Condition.data).severity]
        : []),
      ...(aca03Condition.success
        ? [assessGpa(academics, aca03Condition.data, isFirstTerm).severity]
        : []),
    ].filter((s): s is Severity => s !== null),
  );
}

/**
 * ACA-04 — Sa sút qua các học kỳ (docs/rules/08): so với học kỳ liền trước (theo `Term.startDate`).
 * Học kỳ trước không có kết quả → KHÔNG xét. Không đọc cảnh báo đã lưu — tính lại từ dữ liệu.
 */
export const aca04: StudentRule<Aca04Condition> = {
  kind: 'PER_STUDENT',
  meta: {
    ruleCode: 'ACA-04',
    ruleName: 'Sa sút qua các học kỳ',
    ruleGroup: RuleGroup.ACADEMIC,
    scope: 'PER_STUDENT',
    priority: 85,
    signal: 'ACADEMIC',
    requires: null,
  },
  conditionSchema,
  defaultCondition: {
    minDrop: 1,
    dropSeverity: Severity.MEDIUM,
    consecutiveMinSeverity: Severity.CRITICAL,
    consecutiveSeverity: Severity.CRITICAL,
  },
  maxSeverity: (c) => maxSeverity([c.dropSeverity, c.consecutiveSeverity]) ?? Severity.CRITICAL,

  evaluate(ctx, c) {
    const previous = ctx.previousTerm;
    if (!previous || previous.results.length === 0) return { hit: null };
    const scale = ctx.config.academic.gradeScale;
    const current = termAcademics(termResults(ctx.facts), scale);
    const before = termAcademics(previous.results, scale);
    const [gpaNow, gpaBefore] = [gpaValue(current), gpaValue(before)];
    if (gpaNow === null || gpaBefore === null) return { hit: null };

    const reasons: string[] = [];
    const severities: Severity[] = [];
    const dropTenths = before.pointTenths * current.credits - current.pointTenths * before.credits;
    // Giảm ≥ minDrop, so sánh nguyên: (ĐTB trước − ĐTB nay) × 10 × TC trước × TC nay.
    if (dropTenths >= Math.round(c.minDrop * 10) * before.credits * current.credits) {
      severities.push(c.dropSeverity);
      reasons.push(
        `ĐTB giảm từ ${formatNumber(gpaBefore)} (${previous.termName}) xuống ${formatNumber(gpaNow)}`,
      );
    }
    const levelNow = termLevel(ctx, current, ctx.isFirstTerm);
    const levelBefore = termLevel(ctx, before, previous.isFirstTerm);
    const min = severityRank(c.consecutiveMinSeverity);
    if (
      levelNow &&
      levelBefore &&
      severityRank(levelNow) >= min &&
      severityRank(levelBefore) >= min
    ) {
      severities.push(c.consecutiveSeverity);
      reasons.push(
        `2 học kỳ liên tiếp (${previous.termName} và học kỳ này) chạm ngưỡng cảnh báo học tập theo quy chế — quy chế: 3 lần cảnh báo liên tiếp bị buộc thôi học (tham khảo)`,
      );
    }
    const severity = maxSeverity(severities);
    if (!severity) return { hit: null };
    return {
      hit: {
        severity,
        reason: `${reasons.join('; ')}.`,
        inputSnapshot: {
          previousTermId: previous.termId,
          previousGpa4: gpaBefore,
          gpa4: gpaNow,
          previousLevel: levelBefore,
          level: levelNow,
        },
      },
    };
  },
};
