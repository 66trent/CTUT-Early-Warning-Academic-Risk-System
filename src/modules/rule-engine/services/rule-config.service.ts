import { type EntityManager } from 'typeorm';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { Rule } from '@/db/entities/rule.entity';
import { RuleGroup, RuleStatus, Severity } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import {
  DEFAULT_RISK_SCORE_CONFIG,
  RISK_SCORE_RULE_CODE,
  type RiskScoreConfig,
  riskScoreConfigSchema,
} from '../evaluator/config';
import { getRuleDefinition, RULES } from '../evaluator/rules';
import { type ActiveRule } from '../evaluator/types';

/** Bộ luật ACTIVE đã nạp cho 1 lần chạy. */
export interface ActiveRuleSet {
  activeRules: Map<string, ActiveRule>;
  config: RiskScoreConfig;
  configVersionId: string;
}

/** Hành động mặc định khi luật kích hoạt (docs/rules/06): LOW chỉ trong ứng dụng. */
const actionFor = (severity: Severity) => ({
  channels: severity === Severity.LOW ? ['IN_APP'] : ['IN_APP', 'EMAIL'],
});

/** Kiểm tra `condition` theo Zod của luật (hoặc của RISK-SCORE). Ném AppError nếu sai. */
export function parseCondition(ruleCode: string, condition: unknown): unknown {
  const schema =
    ruleCode === RISK_SCORE_RULE_CODE
      ? riskScoreConfigSchema
      : getRuleDefinition(ruleCode)?.conditionSchema;
  if (!schema) throw new AppError('RULE_NOT_FOUND', `Không có luật ${ruleCode}.`);
  const parsed = schema.safeParse(condition);
  if (!parsed.success) {
    throw new AppError(
      'INVALID_CONDITION',
      `Cấu hình ${ruleCode} chưa hợp lệ: ${parsed.error.issues[0]?.message ?? 'sai cấu trúc'}.`,
    );
  }
  return parsed.data;
}

function severityOf(ruleCode: string, condition: unknown): Severity {
  const def = getRuleDefinition(ruleCode);
  return def ? def.maxSeverity(condition) : Severity.LOW;
}

/** Nạp phiên bản ACTIVE của 12 luật + RISK-SCORE. Chỉ đọc RuleVersion ACTIVE (docs/rules/11). */
export async function loadActiveRuleSet(em: EntityManager): Promise<ActiveRuleSet> {
  const versions = await em.find(RuleVersion, { where: { status: RuleStatus.ACTIVE } });
  const activeRules = new Map<string, ActiveRule>();
  let config: { id: string; value: RiskScoreConfig } | null = null;
  for (const v of versions) {
    if (v.ruleCode === RISK_SCORE_RULE_CODE) {
      config = { id: v.id, value: riskScoreConfigSchema.parse(v.condition) };
    } else if (getRuleDefinition(v.ruleCode)) {
      activeRules.set(v.ruleCode, {
        ruleVersionId: v.id,
        condition: parseCondition(v.ruleCode, v.condition),
      });
    }
  }
  if (!config) {
    throw new AppError('RULES_NOT_SEEDED', 'Chưa có cấu hình RiskScore — chạy npm run seed.');
  }
  return { activeRules, config: config.value, configVersionId: config.id };
}

/**
 * Seed 12 luật + RISK-SCORE với ngưỡng mặc định của docs/rules/08 (idempotent: luật đã có
 * phiên bản thì giữ nguyên). Phiên bản 1 ACTIVE, `lastDryRunAt` = lúc seed (docs/rules/11).
 */
export async function seedRules(em: EntityManager, actorId: string): Promise<number> {
  const now = new Date();
  const entries = [
    ...RULES.map((r) => ({ meta: r.meta, condition: r.defaultCondition })),
    {
      meta: {
        ruleCode: RISK_SCORE_RULE_CODE,
        ruleName: 'Cấu hình RiskScore và tham số dữ liệu chung',
        ruleGroup: RuleGroup.RISK_SCORE,
        scope: 'PER_STUDENT' as const,
        priority: 0,
      },
      condition: DEFAULT_RISK_SCORE_CONFIG as unknown,
    },
  ];
  let created = 0;
  for (const { meta, condition } of entries) {
    await em
      .createQueryBuilder()
      .insert()
      .into(Rule)
      .values({
        ruleCode: meta.ruleCode,
        ruleName: meta.ruleName,
        ruleGroup: meta.ruleGroup,
        scope: meta.scope,
        priority: meta.priority,
        // 0 = tắt: cảnh báo mở lại theo dấu hiệu mới/nặng hơn, không theo thời gian (docs/rules/08).
        cooldown: 0,
        status: RuleStatus.ACTIVE,
      })
      .orIgnore()
      .execute();
    if (await em.existsBy(RuleVersion, { ruleCode: meta.ruleCode })) continue;
    const severity = severityOf(meta.ruleCode, condition);
    await em.insert(RuleVersion, {
      ruleCode: meta.ruleCode,
      version: 1,
      condition: parseCondition(meta.ruleCode, condition) as object,
      severity,
      action: actionFor(severity),
      effectiveFrom: now,
      effectiveTo: null,
      status: RuleStatus.ACTIVE,
      configuredBy: actorId,
      lastDryRunAt: now,
    });
    created += 1;
  }
  return created;
}

/** Sửa ngưỡng = tạo phiên bản mới DRAFT (không ghi đè). Có Audit Log. */
export async function createRuleVersion(
  em: EntityManager,
  ruleCode: string,
  condition: unknown,
  actorId: string,
): Promise<RuleVersion> {
  const parsed = parseCondition(ruleCode, condition) as object;
  const latest = await em.findOne(RuleVersion, {
    where: { ruleCode },
    order: { version: 'DESC' },
    lock: { mode: 'pessimistic_write' },
  });
  // Mỗi luật tối đa 1 bản nháp — tránh nhầm bản nào đã chạy thử.
  if (await em.existsBy(RuleVersion, { ruleCode, status: RuleStatus.DRAFT })) {
    throw new AppError(
      'DRAFT_EXISTS',
      'Luật này đang có bản nháp — kích hoạt hoặc bỏ bản nháp trước.',
    );
  }
  const severity = severityOf(ruleCode, parsed);
  const version = em.create(RuleVersion, {
    ruleCode,
    version: (latest?.version ?? 0) + 1,
    condition: parsed,
    severity,
    action: actionFor(severity),
    effectiveFrom: new Date(),
    effectiveTo: null,
    status: RuleStatus.DRAFT,
    configuredBy: actorId,
    lastDryRunAt: null,
  });
  await em.insert(RuleVersion, version);
  await writeAuditLog(
    {
      actorId,
      action: 'RULE_VERSION_CREATED',
      targetType: 'RuleVersion',
      targetId: version.id,
      detail: { ruleCode, version: version.version, condition: parsed },
    },
    em,
  );
  return version;
}

/** Bỏ bản nháp → ARCHIVED (giữ lại làm lịch sử, không xóa). Có Audit Log. */
export async function discardRuleVersion(
  em: EntityManager,
  versionId: string,
  actorId: string,
): Promise<void> {
  const version = await em.findOne(RuleVersion, {
    where: { id: versionId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!version) throw new AppError('RULE_VERSION_NOT_FOUND', 'Không tìm thấy phiên bản luật.');
  if (version.status !== RuleStatus.DRAFT) {
    throw new AppError('INVALID_STATUS', 'Chỉ bỏ được phiên bản nháp.');
  }
  await em.update(RuleVersion, { id: versionId }, { status: RuleStatus.ARCHIVED });
  await writeAuditLog(
    {
      actorId,
      action: 'RULE_VERSION_DISCARDED',
      targetType: 'RuleVersion',
      targetId: versionId,
      detail: { ruleCode: version.ruleCode, version: version.version },
    },
    em,
  );
}

/**
 * Kích hoạt phiên bản DRAFT đã chạy thử: phiên bản ACTIVE cũ → INACTIVE (`effectiveTo` = lúc
 * này), phiên bản mới → ACTIVE, trong 1 transaction. Chưa chạy thử → từ chối (docs/rules/11).
 */
export async function activateRuleVersion(
  em: EntityManager,
  versionId: string,
  actorId: string,
): Promise<void> {
  const version = await em.findOne(RuleVersion, {
    where: { id: versionId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!version) throw new AppError('RULE_VERSION_NOT_FOUND', 'Không tìm thấy phiên bản luật.');
  if (version.status !== RuleStatus.DRAFT) {
    throw new AppError('INVALID_STATUS', 'Chỉ kích hoạt được phiên bản nháp.');
  }
  if (!version.lastDryRunAt) {
    throw new AppError('DRY_RUN_REQUIRED', 'Hãy chạy thử phiên bản này trước khi kích hoạt.');
  }
  const now = new Date();
  await em.update(
    RuleVersion,
    { ruleCode: version.ruleCode, status: RuleStatus.ACTIVE },
    { status: RuleStatus.INACTIVE, effectiveTo: now },
  );
  await em.update(
    RuleVersion,
    { id: versionId },
    { status: RuleStatus.ACTIVE, effectiveFrom: now, effectiveTo: null },
  );
  await writeAuditLog(
    {
      actorId,
      action: 'RULE_ACTIVATED',
      targetType: 'RuleVersion',
      targetId: versionId,
      detail: { ruleCode: version.ruleCode, version: version.version },
    },
    em,
  );
}
