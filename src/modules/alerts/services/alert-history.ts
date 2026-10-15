import { type EntityManager } from 'typeorm';
import { AlertStateHistory } from '@/db/entities/alert-state-history.entity';
import { type AlertStatus } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';

/**
 * Mỗi lần đổi trạng thái cảnh báo: 1 dòng `AlertStateHistory` + Audit Log `ALERT_STATUS_CHANGED`,
 * cùng transaction (docs/rules/06, 11). `actorId` NULL = hệ thống.
 */
export async function recordAlertTransition(
  em: EntityManager,
  input: {
    alertId: string;
    from: AlertStatus | null;
    to: AlertStatus;
    actorId: string | null;
    reason: string | null;
    at?: Date;
  },
): Promise<void> {
  const at = input.at ?? new Date();
  await em.insert(AlertStateHistory, {
    alertId: input.alertId,
    fromStatus: input.from,
    toStatus: input.to,
    changedBy: input.actorId,
    reason: input.reason,
    changedAt: at,
  });
  await writeAuditLog(
    {
      actorId: input.actorId,
      action: 'ALERT_STATUS_CHANGED',
      targetType: 'Alert',
      targetId: input.alertId,
      detail: { from: input.from, to: input.to, reason: input.reason },
    },
    em,
  );
}
