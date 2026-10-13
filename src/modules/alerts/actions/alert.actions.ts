'use server';

import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { writeAuditLog } from '@/lib/audit';
import { assertScope, type SessionUser } from '@/lib/authz';
import { vnStartOfDay } from '@/lib/dates';
import { type ActionResult, ForbiddenError } from '@/lib/errors';
import {
  acknowledgeLowAlerts,
  changeAlertStatus,
  recordIntervention,
} from '../services/alert-lifecycle.service';
import {
  type AlertDetailDto,
  alertOwner,
  getAlertDetail,
  getTriggerEvidence,
} from '../services/alert-query.service';
import {
  type InAppNotificationDto,
  listInAppNotifications,
  markInAppNotificationsRead,
} from '../services/notification.service';
import {
  alertIdSchema,
  changeAlertStatusSchema,
  interventionSchema,
  termIdSchema,
  triggerIdSchema,
} from '../validators/alert';

const VIEWERS = [UserRole.ADVISOR, UserRole.ADMIN] as const;
const ADVISOR = [UserRole.ADVISOR] as const;
const REVALIDATE = ['/advisor', '/admin/alerts', '/student'];

/** Phạm vi qua lớp sinh hoạt (docs/rules/06) — "không có quyền" và "không tồn tại" cùng 1 lỗi. */
async function scopeAlert(user: SessionUser, alertId: string, action: 'READ' | 'PROCESS') {
  const studentId = await alertOwner(alertId);
  if (!studentId) throw new ForbiddenError();
  await assertScope(user, { studentId, resourceType: 'Alert', action });
  return studentId;
}

/** Chi tiết cảnh báo cho Sheet. Admin xem (chỉ đọc) → Audit Log xem hồ sơ (docs/rules/06). */
export async function getAlertDetailAction(raw: unknown): Promise<ActionResult<AlertDetailDto>> {
  return runAction(raw, {
    roles: VIEWERS,
    schema: alertIdSchema,
    run: async ({ alertId }, user) => {
      const studentId = await scopeAlert(user, alertId, 'READ');
      const canProcess = user.role === UserRole.ADVISOR;
      if (!canProcess) {
        await writeAuditLog({
          actorId: user.userId,
          action: 'STUDENT_PROFILE_VIEWED',
          targetType: 'Alert',
          targetId: alertId,
          detail: { studentId },
        });
      }
      const detail = await getAlertDetail(alertId, { canProcess });
      if (!detail) throw new ForbiddenError();
      return detail;
    },
  });
}

/** Bằng chứng chi tiết 1 dấu hiệu — chỉ tải khi mở Accordion (docs/rules/05). */
export async function getTriggerEvidenceAction(
  raw: unknown,
): Promise<ActionResult<{ label: string; value: string }[]>> {
  return runAction(raw, {
    roles: VIEWERS,
    schema: triggerIdSchema,
    run: async ({ triggerId }, user) => {
      const evidence = await getTriggerEvidence(triggerId);
      if (!evidence) throw new ForbiddenError();
      await assertScope(user, { studentId: evidence.studentId, resourceType: 'Alert' });
      return evidence.rows;
    },
  });
}

/** Đổi trạng thái — chỉ Cố vấn học tập phụ trách (Admin bị chặn ở assertScope PROCESS). */
export async function changeAlertStatusAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADVISOR,
    schema: changeAlertStatusSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await scopeAlert(user, input.alertId, 'PROCESS');
      await changeAlertStatus(input.alertId, input.toStatus, user.userId, input.reason ?? null);
      return null;
    },
  });
}

/** Ghi can thiệp trong Sheet — chỉ Cố vấn học tập phụ trách. */
export async function recordInterventionAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADVISOR,
    schema: interventionSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await scopeAlert(user, input.alertId, 'PROCESS');
      await recordIntervention(
        input.alertId,
        {
          type: input.type,
          content: input.content,
          outcome: input.outcome || null,
          status: input.status,
          nextFollowUpAt: input.nextFollowUpAt ? vnStartOfDay(input.nextFollowUpAt) : null,
          confidentialityLevel: input.confidentialityLevel,
        },
        user.userId,
      );
      return null;
    },
  });
}

/** "Đánh dấu đã xem" mọi cảnh báo mức Thấp đang chờ (phạm vi: lớp của chính mình). */
export async function acknowledgeLowAlertsAction(raw: unknown): Promise<ActionResult<number>> {
  return runAction(raw, {
    roles: ADVISOR,
    schema: termIdSchema,
    revalidate: REVALIDATE,
    run: ({ termId }, user) => acknowledgeLowAlerts(user.userId, termId),
  });
}

export async function listMyNotificationsAction(): Promise<
  ActionResult<{ items: InAppNotificationDto[]; unread: number }>
> {
  return runAction(
    {},
    {
      roles: ADVISOR,
      schema: termIdSchema.partial(),
      run: (_, user) => listInAppNotifications(user.userId),
    },
  );
}

export async function markNotificationsReadAction(): Promise<ActionResult<null>> {
  return runAction(
    {},
    {
      roles: ADVISOR,
      schema: termIdSchema.partial(),
      run: async (_, user) => {
        await markInAppNotificationsRead(user.userId);
        return null;
      },
    },
  );
}
