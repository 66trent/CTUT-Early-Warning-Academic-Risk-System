import { z } from 'zod';
import { getDataSource } from '@/db/data-source';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { Rule } from '@/db/entities/rule.entity';
import { Term } from '@/db/entities/term.entity';
import { type RuleGroup, RuleStatus, type Severity } from '@/db/enums';
import { getEnv } from '@/lib/env';
import { type ConditionSchema, type ConditionValue } from '../condition-schema';
import { RISK_SCORE_RULE_CODE, riskScoreConfigSchema } from '../evaluator/config';
import { getRuleDefinition } from '../evaluator/rules';

export interface RuleListItemDto {
  ruleCode: string;
  ruleName: string;
  ruleGroup: RuleGroup;
  scope: string;
  activeVersion: number | null;
  activeSeverity: Severity | null;
  activeSince: string | null;
  hasDraft: boolean;
}

export interface RuleVersionDto {
  id: string;
  version: number;
  status: RuleStatus;
  severity: Severity;
  condition: ConditionValue;
  configuredBy: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  lastDryRunAt: string | null;
}

export interface RuleDetailDto {
  ruleCode: string;
  ruleName: string;
  ruleGroup: RuleGroup;
  scope: string;
  schema: ConditionSchema;
  active: RuleVersionDto | null;
  draft: RuleVersionDto | null;
  versions: RuleVersionDto[];
  /** Học kỳ để chạy thử — mặc định học kỳ hiện tại. */
  terms: { termId: string; termName: string; isCurrent: boolean }[];
  /** Chỉ DEMO_MODE=true mới chọn được mốc dữ liệu trong quá khứ (docs/rules/06). */
  canChooseAsOf: boolean;
}

/** Zod của `condition` → JSON Schema rút gọn cho form tự sinh. */
function conditionSchemaOf(ruleCode: string): ConditionSchema | null {
  const schema =
    ruleCode === RISK_SCORE_RULE_CODE
      ? riskScoreConfigSchema
      : getRuleDefinition(ruleCode)?.conditionSchema;
  return schema ? (z.toJSONSchema(schema, { io: 'input' }) as ConditionSchema) : null;
}

function toVersionDto(v: RuleVersion): RuleVersionDto {
  return {
    id: v.id,
    version: v.version,
    status: v.status,
    severity: v.severity,
    // jsonb đã là dữ liệu JSON thuần — sao chép để chắc chắn không mang prototype lạ.
    condition: JSON.parse(JSON.stringify(v.condition)) as ConditionValue,
    configuredBy: v.configuredBy,
    effectiveFrom: v.effectiveFrom.toISOString(),
    effectiveTo: v.effectiveTo?.toISOString() ?? null,
    lastDryRunAt: v.lastDryRunAt?.toISOString() ?? null,
  };
}

/** 12 luật + RISK-SCORE kèm phiên bản đang áp dụng, theo thứ tự xử lý (`priority`). */
export async function listRules(): Promise<RuleListItemDto[]> {
  const ds = await getDataSource();
  const [rules, versions] = await Promise.all([
    ds.getRepository(Rule).find({ order: { priority: 'ASC', ruleCode: 'ASC' } }),
    ds.getRepository(RuleVersion).find({
      select: {
        ruleCode: true,
        version: true,
        status: true,
        severity: true,
        effectiveFrom: true,
      },
      where: [{ status: RuleStatus.ACTIVE }, { status: RuleStatus.DRAFT }],
    }),
  ]);
  return rules.map((r) => {
    const active = versions.find(
      (v) => v.ruleCode === r.ruleCode && v.status === RuleStatus.ACTIVE,
    );
    return {
      ruleCode: r.ruleCode,
      ruleName: r.ruleName,
      ruleGroup: r.ruleGroup,
      scope: r.scope,
      activeVersion: active?.version ?? null,
      activeSeverity: active?.severity ?? null,
      activeSince: active?.effectiveFrom.toISOString() ?? null,
      hasDraft: versions.some((v) => v.ruleCode === r.ruleCode && v.status === RuleStatus.DRAFT),
    };
  });
}

export async function getRuleDetail(ruleCode: string): Promise<RuleDetailDto | null> {
  const ds = await getDataSource();
  const rule = await ds.getRepository(Rule).findOneBy({ ruleCode });
  const schema = conditionSchemaOf(ruleCode);
  if (!rule || !schema) return null;
  const [versions, terms] = await Promise.all([
    ds.getRepository(RuleVersion).find({ where: { ruleCode }, order: { version: 'DESC' } }),
    ds.getRepository(Term).find({
      select: { termId: true, termName: true, isCurrent: true, startDate: true },
      order: { isCurrent: 'DESC', startDate: 'DESC' },
      take: 50,
    }),
  ]);
  const dtos = versions.map(toVersionDto);
  return {
    ruleCode: rule.ruleCode,
    ruleName: rule.ruleName,
    ruleGroup: rule.ruleGroup,
    scope: rule.scope,
    schema,
    active: dtos.find((v) => v.status === RuleStatus.ACTIVE) ?? null,
    draft: dtos.find((v) => v.status === RuleStatus.DRAFT) ?? null,
    versions: dtos,
    terms: terms.map((t) => ({ termId: t.termId, termName: t.termName, isCurrent: t.isCurrent })),
    canChooseAsOf: getEnv().DEMO_MODE,
  };
}
