import { getQueue, QUEUE_NAMES } from '@/lib/queue/queues';

export const NOTIFICATION_JOB = 'send-email';

/** Đưa email vào hàng đợi `send-notifications`. jobId = id thông báo → không gửi trùng khi chạy lại. */
export type NotificationEnqueuer = (notificationIds: readonly string[]) => Promise<void>;

export const enqueueNotificationEmails: NotificationEnqueuer = async (ids) => {
  if (ids.length === 0) return;
  await getQueue(QUEUE_NAMES.sendNotifications).addBulk(
    ids.map((notificationId) => ({
      name: NOTIFICATION_JOB,
      data: { notificationId },
      opts: { jobId: notificationId },
    })),
  );
};
