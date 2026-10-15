import { randomUUID } from 'node:crypto';
import { In, IsNull, type EntityManager } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import { Notification } from '@/db/entities/notification.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import {
  NotificationChannel,
  type NotificationEvent,
  NotificationStatus,
  Severity,
  SEVERITY_ORDER,
} from '@/db/enums';
import { APP_NAME } from '@/lib/app-config';
import { getEnv } from '@/lib/env';
import { SEVERITY_LABELS } from '@/lib/labels';
import { sendMail } from '@/lib/mailer';
import { type AlertEvent } from './alert-sync.service';
import { loadCurrentTriggers } from './current-signals';

const EVENT_LABELS: Record<NotificationEvent, string> = {
  CREATED: 'Sinh viên có dấu hiệu cần hỗ trợ',
  REOPENED: 'Cảnh báo đã đóng có dấu hiệu mới',
  SEVERITY_INCREASED: 'Mức cảnh báo tăng',
};

/**
 * Tạo thông báo cho các sự kiện (docs/rules/06): chỉ Cố vấn học tập phụ trách; LOW chỉ IN_APP,
 * MEDIUM trở lên IN_APP + EMAIL. Không chống gửi trùng theo tần suất (người dùng bỏ) — UNIQUE
 * (cảnh báo, kênh, sự kiện, lần chạy) chỉ chặn trùng khi job chạy lại. Trả id email cần gửi.
 */
export async function createNotificationsForEvents(
  em: EntityManager,
  events: readonly AlertEvent[],
  evaluationRunId: string,
): Promise<string[]> {
  const now = new Date();
  const rows: Partial<Notification>[] = [];
  for (const e of events) {
    if (!e.recipientId) continue;
    const base = {
      alertId: e.alertId,
      recipientId: e.recipientId,
      event: e.event,
      evaluationRunId,
    };
    rows.push({
      ...base,
      notificationId: randomUUID(),
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      sentAt: now,
    });
    if (SEVERITY_ORDER.indexOf(e.severity) >= SEVERITY_ORDER.indexOf(Severity.MEDIUM)) {
      rows.push({
        ...base,
        notificationId: randomUUID(),
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.QUEUED,
      });
    }
  }
  if (rows.length === 0) return [];
  await em.createQueryBuilder().insert().into(Notification).values(rows).orIgnore().execute();
  const emailIds = rows
    .filter((r) => r.channel === NotificationChannel.EMAIL)
    .map((r) => r.notificationId ?? '');
  if (emailIds.length === 0) return [];
  const inserted = await em.find(Notification, {
    select: { notificationId: true },
    where: { notificationId: In(emailIds) },
  });
  return inserted.map((n) => n.notificationId);
}

/** Nội dung email — KHÔNG có số liệu thô (inputSnapshot) hay nội dung can thiệp (docs/rules/06). */
async function buildEmail(n: Notification): Promise<{ to: string; subject: string; text: string }> {
  const ds = await getDataSource();
  const alert = await ds.getRepository(Alert).findOneByOrFail({ alertId: n.alertId });
  const [student, term, recipient, triggers] = await Promise.all([
    ds.getRepository(Student).findOneByOrFail({ studentId: alert.studentId }),
    ds.getRepository(Term).findOneByOrFail({ termId: alert.termId }),
    ds.getRepository(User).findOneByOrFail({ userId: n.recipientId }),
    loadCurrentTriggers(ds.manager, [alert]).then((m) => (m.get(alert.alertId) ?? []).slice(0, 5)),
  ]);
  const event = n.event as NotificationEvent;
  const link = `${getEnv().BETTER_AUTH_URL}/advisor?alert=${alert.alertId}`;
  return {
    to: recipient.email,
    subject: `[${APP_NAME}] ${EVENT_LABELS[event]}: ${student.fullName} (${SEVERITY_LABELS[alert.severity]})`,
    text:
      `Kính gửi ${recipient.fullName},\n\n` +
      `Hệ thống ghi nhận sinh viên ${student.fullName} (${student.studentId}, lớp ${student.classId}) ` +
      `có dấu hiệu cần hỗ trợ trong ${term.termName} — mức ${SEVERITY_LABELS[alert.severity]}.\n\n` +
      `Dấu hiệu chính:\n${triggers.map((t) => `- ${t.reason}`).join('\n')}\n\n` +
      `Xem chi tiết và ghi nhận can thiệp: ${link}\n\n` +
      'Cảnh báo sớm — mang tính tham khảo, không phải quyết định học vụ chính thức.',
  };
}

/** Job `send-notifications`: gửi 1 email. Lỗi → ném để retry; hết lượt thử → FAILED. Idempotent. */
export async function sendNotificationEmail(notificationId: string): Promise<void> {
  const repo = (await getDataSource()).getRepository(Notification);
  const n = await repo.findOneBy({ notificationId, channel: NotificationChannel.EMAIL });
  if (!n || n.status !== NotificationStatus.QUEUED) return;
  await sendMail(await buildEmail(n));
  await repo.update({ notificationId }, { status: NotificationStatus.SENT, sentAt: new Date() });
}

export async function failNotification(notificationId: string): Promise<void> {
  await (
    await getDataSource()
  )
    .getRepository(Notification)
    .update(
      { notificationId, status: NotificationStatus.QUEUED },
      { status: NotificationStatus.FAILED },
    );
}

export interface InAppNotificationDto {
  notificationId: string;
  alertId: string;
  title: string;
  studentName: string;
  severity: Severity;
  createdAt: string;
  read: boolean;
}

/** Chuông thông báo: 20 thông báo trong ứng dụng gần nhất + số chưa đọc. */
export async function listInAppNotifications(
  userId: string,
): Promise<{ items: InAppNotificationDto[]; unread: number }> {
  const ds = await getDataSource();
  const repo = ds.getRepository(Notification);
  const [rows, unread] = await Promise.all([
    repo.find({
      where: { recipientId: userId, channel: NotificationChannel.IN_APP },
      relations: { alert: { student: true } },
      order: { createdAt: 'DESC' },
      take: 20,
    }),
    repo.countBy({ recipientId: userId, channel: NotificationChannel.IN_APP, readAt: IsNull() }),
  ]);
  return {
    unread,
    items: rows.map((n) => ({
      notificationId: n.notificationId,
      alertId: n.alertId,
      title: EVENT_LABELS[n.event as NotificationEvent] ?? 'Thông báo',
      studentName: n.alert?.student?.fullName ?? '',
      severity: n.alert?.severity ?? Severity.LOW,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt !== null,
    })),
  };
}

/** Đánh dấu đã đọc mọi thông báo trong ứng dụng của chính người dùng. */
export async function markInAppNotificationsRead(userId: string): Promise<void> {
  await (
    await getDataSource()
  )
    .getRepository(Notification)
    .update(
      { recipientId: userId, channel: NotificationChannel.IN_APP, readAt: IsNull() },
      { readAt: new Date() },
    );
}
