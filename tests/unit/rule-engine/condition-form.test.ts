import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type ConditionSchema,
  defaultValueFor,
  flattenCondition,
  numberStep,
} from '@/modules/rule-engine/condition-schema';
import {
  riskScoreConfigSchema,
  RISK_SCORE_RULE_CODE,
} from '@/modules/rule-engine/evaluator/config';
import { RULES } from '@/modules/rule-engine/evaluator/rules';
import { CONDITION_FIELD_LABELS, conditionFieldLabel } from '@/modules/rule-engine/labels';

const SUPPORTED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean']);

const allSchemas: [string, ConditionSchema][] = [
  ...RULES.map((r): [string, ConditionSchema] => [
    r.meta.ruleCode,
    z.toJSONSchema(r.conditionSchema, { io: 'input' }) as ConditionSchema,
  ]),
  [RISK_SCORE_RULE_CODE, z.toJSONSchema(riskScoreConfigSchema, { io: 'input' }) as ConditionSchema],
];

/** Mọi khóa trường (đệ quy) và kiểu của nó. */
function walk(schema: ConditionSchema, visit: (key: string, s: ConditionSchema) => void) {
  for (const [key, s] of Object.entries(schema.properties ?? {})) {
    visit(key, s);
    walk(s, visit);
  }
  if (schema.items) walk(schema.items, visit);
}

describe('Form cấu hình luật tự sinh từ condition', () => {
  it.each(allSchemas)(
    '%s: mọi trường có nhãn tiếng Việt và kiểu form hỗ trợ',
    (ruleCode, schema) => {
      walk(schema, (key, s) => {
        expect(conditionFieldLabel(ruleCode, key), `${ruleCode}.${key}`).not.toBe(key);
        if (s.type) expect(SUPPORTED_TYPES.has(s.type), `${ruleCode}.${key}: ${s.type}`).toBe(true);
      });
    },
  );

  it('nhãn riêng theo luật ghi đè nhãn chung', () => {
    expect(conditionFieldLabel('ACA-02', 'percent')).toBe(CONDITION_FIELD_LABELS['ACA-02:percent']);
    expect(conditionFieldLabel('COMB-01', 'percent')).toBe(CONDITION_FIELD_LABELS.percent);
  });

  it('dòng mới thêm vào dải ngưỡng hợp lệ với Zod của luật sau khi chọn giá trị mặc định', () => {
    const att01 = allSchemas.find(([code]) => code === 'ATT-01')?.[1];
    const band = defaultValueFor(att01?.properties?.bands?.items ?? {});
    expect(band).toEqual({ percent: 1, op: 'gte', severity: 'LOW' });
  });

  it('bước nhập: số nguyên 1, bội số 0,5 theo multipleOf, số thực 0,01', () => {
    expect(numberStep({ type: 'integer' })).toBe(1);
    expect(numberStep({ type: 'number', multipleOf: 0.5 })).toBe(0.5);
    expect(numberStep({ type: 'number' })).toBe(0.01);
  });

  it('làm phẳng condition để so sánh thay đổi giữa 2 phiên bản', () => {
    expect(flattenCondition({ minLate: 3, bands: [{ percent: 10 }], countExcused: true })).toEqual([
      { path: 'minLate', value: '3' },
      { path: 'bands[1].percent', value: '10' },
      { path: 'countExcused', value: 'true' },
    ]);
  });

  it('giá trị mặc định của mọi luật đi qua form không đổi khi parse lại bằng Zod', () => {
    for (const rule of RULES) {
      const roundTrip = JSON.parse(JSON.stringify(rule.defaultCondition)) as unknown;
      expect(rule.conditionSchema.safeParse(roundTrip).success, rule.meta.ruleCode).toBe(true);
    }
  });
});
