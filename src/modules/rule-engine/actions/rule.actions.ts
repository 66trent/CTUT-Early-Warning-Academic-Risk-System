'use server';

import { getDataSource } from '@/db/data-source';
import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { type ActionResult } from '@/lib/errors';
import { dryRunRuleVersion, type DryRunResultDto } from '../services/dry-run.service';
import {
  activateRuleVersion,
  createRuleVersion,
  discardRuleVersion,
} from '../services/rule-config.service';
import {
  createRuleVersionSchema,
  dryRunSchema,
  ruleVersionIdSchema,
} from '../validators/evaluation';
import { resolveAsOf } from './as-of';

/**
 * Cấu hình luật (Admin): tạo bản nháp → chạy thử → kích hoạt (docs/rules/11). Mọi thay đổi ghi
 * Audit Log trong service, cùng transaction (docs/rules/06).
 */
const REVALIDATE = ['/admin/rules'];

export async function createRuleVersionAction(
  raw: unknown,
): Promise<ActionResult<{ versionId: string }>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: createRuleVersionSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      const version = await (
        await getDataSource()
      ).transaction((em) => createRuleVersion(em, input.ruleCode, input.condition, user.userId));
      return { versionId: version.id };
    },
  });
}

export async function dryRunRuleVersionAction(
  raw: unknown,
): Promise<ActionResult<DryRunResultDto>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: dryRunSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      const asOf = resolveAsOf(input.asOfDate || undefined);
      return (await getDataSource()).transaction((em) =>
        dryRunRuleVersion(em, input.versionId, input.termId, user.userId, asOf),
      );
    },
  });
}

export async function activateRuleVersionAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: ruleVersionIdSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await (
        await getDataSource()
      ).transaction((em) => activateRuleVersion(em, input.versionId, user.userId));
      return null;
    },
  });
}

export async function discardRuleVersionAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: ruleVersionIdSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await (
        await getDataSource()
      ).transaction((em) => discardRuleVersion(em, input.versionId, user.userId));
      return null;
    },
  });
}
