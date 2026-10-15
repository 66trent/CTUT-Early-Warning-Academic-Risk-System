import { type Job } from 'bullmq';
import { z } from 'zod';
import {
  failNotification,
  sendNotificationEmail,
} from '@/modules/alerts/services/notification.service';

const jobData = z.object({ notificationId: z.uuid() });

/** Queue `send-notifications`: gửi 1 email thông báo cho Cố vấn học tập (docs/rules/06). */
export async function processNotificationJob(job: Job): Promise<unknown> {
  return sendNotificationEmail(jobData.parse(job.data).notificationId);
}

/** Hết số lần thử (SMTP lỗi) → FAILED, không biến mất âm thầm (docs/rules/01). */
export async function onNotificationJobFailed(job: Job | undefined): Promise<void> {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = jobData.safeParse(job.data);
  if (parsed.success) await failNotification(parsed.data.notificationId);
}
