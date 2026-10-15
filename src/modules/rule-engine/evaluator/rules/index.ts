import { type RuleDefinition } from '../types';
import { aca01 } from './aca-01';
import { aca02 } from './aca-02';
import { aca03 } from './aca-03';
import { att01 } from './att-01';
import { att02 } from './att-02';
import { att03 } from './att-03';
import { comb01 } from './comb-01';
import { comb02 } from './comb-02';
import { lms01 } from './lms-01';
import { lms02 } from './lms-02';

/**
 * Registry DUY NHẤT 10 luật (docs/rules/08). Engine chỉ duyệt danh sách này — thêm luật =
 * thêm 1 file + 1 dòng ở đây (docs/rules/01). Thứ tự = `priority`; COMB-* luôn chạy sau cùng.
 */
export const RULES: readonly RuleDefinition[] = [
  att01,
  att02,
  att03,
  lms01,
  lms02,
  aca01,
  aca02,
  aca03,
  comb01,
  comb02,
] as readonly RuleDefinition[];

export function getRuleDefinition(ruleCode: string): RuleDefinition | undefined {
  return RULES.find((r) => r.meta.ruleCode === ruleCode);
}
