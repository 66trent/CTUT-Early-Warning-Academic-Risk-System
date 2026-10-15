import { type EntityManager } from 'typeorm';
import { z } from 'zod';
import { getDataSource } from '@/db/data-source';
import { AuditLog } from '@/db/entities/audit-log.entity';

/**
 * Hàm DUY NHẤT ghi Audit Log (docs/rules/06). Append-only: không có hàm sửa/xóa.
 * Danh sách hành động hay mở rộng → lưu varchar, kiểm tra bằng union + Zod.
 */
export const AUDIT_ACTIONS = [
  'LOGIN_FAILED',
  'SIGN_IN_REJECTED',
  'ADVISOR_REGISTERED',
  'DEMO_QUICK_LOGIN',
  'ACCOUNT_APPROVED',
  'ACCOUNT_REJECTED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REACTIVATED',
  'STAFF_CODE_CHANGED',
  'ROLE_CHANGED',
  'TERM_CREATED',
  'TERM_SET_CURRENT',
  'TERM_CLOSED',
  'CLASS_CREATED',
  'CLASS_UPDATED',
  'CLASS_ADVISOR_CHANGED',
  'IMPORT_CREATED',
  'IMPORT_CONFIRMED',
  'IMPORT_LOADED',
  'IMPORT_REJECTED',
  'IMPORT_DISCARDED',
  'IMPORT_EXPIRED',
  'IMPORT_ROLLED_BACK',
  'RULE_VERSION_CREATED',
  'RULE_DRY_RUN',
  'RULE_ACTIVATED',
  'RULE_VERSION_DISCARDED',
  'EVALUATION_RUN_REQUESTED',
  'ENROLLMENT_WITHDRAWN',
  'ENROLLMENT_WITHDRAWAL_UNDONE',
  'ALERT_STATUS_CHANGED',
  'ALERTS_REASSIGNED',
  'INTERVENTION_RECORDED',
  'STUDENT_PROFILE_VIEWED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Khóa có thể chứa dữ liệu nhạy cảm — luôn bị loại trước khi ghi. */
const REDACTED_KEYS = new Set(['password', 'token', 'secret', 'content', 'accessToken', 'idToken']);

const payloadSchema = z.object({
  actorId: z.string().max(20).nullable(),
  action: z.enum(AUDIT_ACTIONS),
  targetType: z.string().min(1).max(40),
  targetId: z.string().max(40).nullable(),
  detail: z.record(z.string(), z.unknown()).nullable(),
});

export interface AuditLogInput {
  actorId: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
}

function redact(
  detail: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!detail) return null;
  return Object.fromEntries(Object.entries(detail).filter(([key]) => !REDACTED_KEYS.has(key)));
}

/**
 * Ghi 1 dòng Audit Log. Truyền `em` khi đang trong transaction để log và thay đổi
 * nghiệp vụ cùng commit/rollback. Lỗi ghi log được ném ra cho nơi gọi xử lý.
 */
export async function writeAuditLog(input: AuditLogInput, em?: EntityManager): Promise<void> {
  const data = payloadSchema.parse({
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    detail: redact(input.detail),
  });
  const manager = em ?? (await getDataSource()).manager;
  await manager.save(manager.create(AuditLog, data));
}
