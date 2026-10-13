import { In, type EntityManager } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Alert } from '@/db/entities/alert.entity';
import { Intervention } from '@/db/entities/intervention.entity';
import { Student } from '@/db/entities/student.entity';
import {
  AlertStatus,
  type ConfidentialityLevel,
  type InterventionStatus,
  type InterventionType,
  OPEN_ALERT_STATUSES,
  Severity,
} from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { recordAlertTransition } from './alert-history';

/**
 * Bảng chuyển trạng thái Cố vấn học tập được làm (docs/rules/11). REOPENED và INVALIDATED sau
 * hoàn tác lô là của HỆ THỐNG (alert-sync). Admin không có chuyển nào (chặn ở assertScope).
 */
export const ADVISOR_TRANSITIONS: Record<AlertStatus, readonly AlertStatus[]> = {
  [AlertStatus.OPEN]: [AlertStatus.ACKNOWLEDGED, AlertStatus.DISMISSED, AlertStatus.INVALIDATED],
  [AlertStatus.REOPENED]: [
    AlertStatus.ACKNOWLEDGED,
    AlertStatus.DISMISSED,
    AlertStatus.INVALIDATED,
  ],
  [AlertStatus.ACKNOWLEDGED]: [
    AlertStatus.IN_PROGRESS,
    AlertStatus.DISMISSED,
    AlertStatus.INVALIDATED,
  ],
  [AlertStatus.IN_PROGRESS]: [AlertStatus.RESOLVED, AlertStatus.DISMISSED, AlertStatus.INVALIDATED],
  [AlertStatus.RESOLVED]: [],
  [AlertStatus.DISMISSED]: [],
  [AlertStatus.INVALIDATED]: [],
};

const NEEDS_REASON: readonly AlertStatus[] = [AlertStatus.DISMISSED, AlertStatus.INVALIDATED];
const CLOSING: readonly AlertStatus[] = [AlertStatus.RESOLVED, AlertStatus.DISMISSED];

async function lockAlert(em: EntityManager, alertId: string): Promise<Alert> {
  const alert = await em.findOne(Alert, {
    where: { alertId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!alert) throw new AppError('ALERT_NOT_FOUND', 'Không tìm thấy cảnh báo.');
  return alert;
}

/** Đổi trạng thái theo bảng chuyển; gọi SAU assertScope(PROCESS) ở Server Action. */
export async function changeAlertStatus(
  alertId: string,
  to: AlertStatus,
  actorId: string,
  reason: string | null,
): Promise<void> {
  const ds = await getDataSource();
  await ds.transaction(async (em) => {
    const alert = await lockAlert(em, alertId);
    if (!ADVISOR_TRANSITIONS[alert.status].includes(to)) {
      throw new AppError(
        'INVALID_TRANSITION',
        'Không chuyển được sang trạng thái này từ trạng thái hiện tại.',
      );
    }
    const note = reason?.trim() || null;
    if (NEEDS_REASON.includes(to) && !note) {
      throw new AppError('REASON_REQUIRED', 'Hãy ghi lý do.');
    }
    if (to === AlertStatus.RESOLVED && !(await em.existsBy(Intervention, { alertId }))) {
      throw new AppError(
        'INTERVENTION_REQUIRED',
        'Hãy ghi ít nhất 1 lần can thiệp trước khi đánh dấu đã xử lý.',
      );
    }
    await em.update(
      Alert,
      { alertId },
      {
        status: to,
        closedAt: CLOSING.includes(to) || to === AlertStatus.INVALIDATED ? new Date() : null,
        closedReason: NEEDS_REASON.includes(to) ? note : null,
      },
    );
    await recordAlertTransition(em, { alertId, from: alert.status, to, actorId, reason: note });
  });
}

export interface InterventionInput {
  type: InterventionType;
  content: string;
  outcome: string | null;
  status: InterventionStatus;
  nextFollowUpAt: Date | null;
  confidentialityLevel: ConfidentialityLevel;
}

/**
 * Ghi 1 can thiệp (docs/rules/11). Cảnh báo đang OPEN/REOPENED/ACKNOWLEDGED → tự chuyển
 * IN_PROGRESS. Audit Log KHÔNG chứa nội dung can thiệp (docs/rules/04, 06).
 */
export async function recordIntervention(
  alertId: string,
  input: InterventionInput,
  actorId: string,
): Promise<void> {
  const ds = await getDataSource();
  await ds.transaction(async (em) => {
    const alert = await lockAlert(em, alertId);
    if (!OPEN_ALERT_STATUSES.includes(alert.status)) {
      throw new AppError('ALERT_CLOSED', 'Cảnh báo đã đóng, không ghi thêm can thiệp được.');
    }
    const intervention = em.create(Intervention, {
      alertId,
      performedBy: actorId,
      type: input.type,
      content: input.content,
      performedAt: new Date(),
      outcome: input.outcome,
      nextFollowUpAt: input.nextFollowUpAt,
      status: input.status,
      confidentialityLevel: input.confidentialityLevel,
    });
    await em.insert(Intervention, intervention);
    await writeAuditLog(
      {
        actorId,
        action: 'INTERVENTION_RECORDED',
        targetType: 'Alert',
        targetId: alertId,
        detail: {
          interventionId: intervention.interventionId,
          type: input.type,
          confidentialityLevel: input.confidentialityLevel,
        },
      },
      em,
    );
    if (alert.status !== AlertStatus.IN_PROGRESS) {
      await em.update(Alert, { alertId }, { status: AlertStatus.IN_PROGRESS });
      await recordAlertTransition(em, {
        alertId,
        from: alert.status,
        to: AlertStatus.IN_PROGRESS,
        actorId,
        reason: 'Đã ghi nhận can thiệp.',
      });
    }
  });
}

/** "Đánh dấu đã xem" mọi cảnh báo mức Thấp đang chờ của Cố vấn học tập trong học kỳ (docs/rules/07). */
export async function acknowledgeLowAlerts(advisorId: string, termId: string): Promise<number> {
  const ds = await getDataSource();
  return ds.transaction(async (em) => {
    const alerts = await em
      .createQueryBuilder(Alert, 'a')
      .innerJoin(Student, 's', 's.studentId = a.studentId')
      .innerJoin(AdministrativeClass, 'c', 'c.classId = s.classId')
      .where('c.advisorId = :advisorId', { advisorId })
      .andWhere('a.termId = :termId', { termId })
      .andWhere('a.severity = :low', { low: Severity.LOW })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AlertStatus.OPEN, AlertStatus.REOPENED],
      })
      .setLock('pessimistic_write')
      .getMany();
    for (const alert of alerts) {
      await em.update(Alert, { alertId: alert.alertId }, { status: AlertStatus.ACKNOWLEDGED });
      await recordAlertTransition(em, {
        alertId: alert.alertId,
        from: alert.status,
        to: AlertStatus.ACKNOWLEDGED,
        actorId: advisorId,
        reason: 'Đánh dấu đã xem các cảnh báo mức Thấp.',
      });
    }
    return alerts.length;
  });
}

/**
 * Chuyển cảnh báo ĐANG MỞ của các sinh viên sang Cố vấn học tập mới, trong transaction `em` của
 * thao tác gọi (đổi Cố vấn học tập của lớp, sinh viên đổi lớp — docs/rules/09). Quyền xem/xử lý
 * vốn suy ra qua lớp, cột này cập nhật để thông báo và lịch sử đúng người.
 */
export async function transferOpenAlerts(
  em: EntityManager,
  studentIds: readonly string[],
  advisorId: string | null,
  actorId: string | null,
): Promise<number> {
  if (studentIds.length === 0) return 0;
  const result = await em.update(
    Alert,
    { studentId: In([...studentIds]), status: In([...OPEN_ALERT_STATUSES]) },
    { assignedAdvisorId: advisorId },
  );
  const moved = result.affected ?? 0;
  if (moved > 0) {
    await writeAuditLog(
      {
        actorId,
        action: 'ALERTS_REASSIGNED',
        targetType: 'Alert',
        targetId: null,
        detail: { students: studentIds.length, alerts: moved, toAdvisorId: advisorId },
      },
      em,
    );
  }
  return moved;
}

/** Sinh viên của 1 lớp — dùng khi đổi Cố vấn học tập của lớp. */
export async function studentIdsOfClass(em: EntityManager, classId: string): Promise<string[]> {
  const rows = await em.find(Student, { select: { studentId: true }, where: { classId } });
  return rows.map((r) => r.studentId);
}
