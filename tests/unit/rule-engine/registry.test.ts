import { describe, expect, it } from 'vitest';
import { Severity } from '@/db/enums';
import {
  DEFAULT_RISK_SCORE_CONFIG,
  riskScoreConfigSchema,
} from '@/modules/rule-engine/evaluator/config';
import { getRuleDefinition, RULES } from '@/modules/rule-engine/evaluator/rules';

describe('Registry 12 luật (docs/rules/08 bản 2)', () => {
  it('đúng 12 mã luật theo định dạng NHÓM-số, không trùng', () => {
    const codes = RULES.map((r) => r.meta.ruleCode);
    expect(codes).toEqual([
      'ATT-01',
      'ATT-02',
      'LMS-01',
      'LMS-02',
      'LMS-03',
      'LMS-04',
      'ACA-01',
      'ACA-02',
      'ACA-03',
      'ACA-04',
      'COMB-01',
      'COMB-02',
    ]);
    expect(new Set(codes).size).toBe(12);
    expect(codes.every((c) => /^[A-Z]+-\d{2}$/.test(c))).toBe(true);
  });

  it('ngưỡng mặc định hợp lệ theo Zod của từng luật; mức cao nhất đúng đặc tả', () => {
    const expected: Record<string, Severity> = {
      'ATT-01': Severity.CRITICAL,
      'ATT-02': Severity.HIGH,
      'LMS-01': Severity.HIGH,
      'LMS-02': Severity.MEDIUM,
      'LMS-03': Severity.HIGH,
      'LMS-04': Severity.LOW,
      'ACA-01': Severity.HIGH,
      'ACA-02': Severity.CRITICAL,
      'ACA-03': Severity.CRITICAL,
      'ACA-04': Severity.CRITICAL,
      'COMB-01': Severity.CRITICAL,
      'COMB-02': Severity.CRITICAL,
    };
    for (const rule of RULES) {
      const parsed = rule.conditionSchema.safeParse(rule.defaultCondition);
      expect(parsed.success, rule.meta.ruleCode).toBe(true);
      expect(rule.maxSeverity(rule.defaultCondition), rule.meta.ruleCode).toBe(
        expected[rule.meta.ruleCode],
      );
    }
  });

  it('phạm vi: ACA-02/03/04 theo sinh viên, còn lại theo học phần; COMB-* chạy sau cùng; ACA-01 xét học phần đã có kết quả', () => {
    expect(RULES.filter((r) => r.kind === 'PER_STUDENT').map((r) => r.meta.ruleCode)).toEqual([
      'ACA-02',
      'ACA-03',
      'ACA-04',
    ]);
    expect(
      RULES.filter((r) => r.kind === 'PER_COURSE' && r.appliesTo === 'COMPLETED').map(
        (r) => r.meta.ruleCode,
      ),
    ).toEqual(['ACA-01']);
    const combined = RULES.filter((r) => r.kind === 'PER_COURSE' && r.stage === 'COMBINED');
    expect(combined.map((r) => r.meta.ruleCode)).toEqual(['COMB-01', 'COMB-02']);
  });

  it('cấu hình sai bị Zod từ chối (không ghi được vào RuleVersion)', () => {
    expect(getRuleDefinition('ATT-01')?.conditionSchema.safeParse({ bands: [] }).success).toBe(
      false,
    );
    expect(getRuleDefinition('XXX-99')).toBeUndefined();
    const zeroWeights = {
      ...DEFAULT_RISK_SCORE_CONFIG,
      weights: { attendance: 0, lms: 0, academic: 0 },
    };
    expect(riskScoreConfigSchema.safeParse(zeroWeights).success).toBe(false);
    expect(riskScoreConfigSchema.safeParse(DEFAULT_RISK_SCORE_CONFIG).success).toBe(true);
    // Quy chế 336: A = 3,8 (1 chữ số thập phân hợp lệ, 3,85 thì không).
    expect(DEFAULT_RISK_SCORE_CONFIG.academic.gradeScale.A).toBe(3.8);
    const badScale = {
      ...DEFAULT_RISK_SCORE_CONFIG,
      academic: { ...DEFAULT_RISK_SCORE_CONFIG.academic, gradeScale: { A: 3.85 } },
    };
    expect(riskScoreConfigSchema.safeParse(badScale).success).toBe(false);
  });
});
