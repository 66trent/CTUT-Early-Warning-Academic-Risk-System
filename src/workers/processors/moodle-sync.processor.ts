import { type Job } from 'bullmq';
import { z } from 'zod';
import {
  failMoodleSync,
  MOODLE_SYNC_JOB,
  runMoodleSync,
} from '@/modules/data-import/services/moodle-sync.service';

const jobData = z.object({ runId: z.uuid() });

/** Queue `moodle-sync`: 1 job / lần đồng bộ Moodle (docs/rules/12, Phase 10b). */
export async function processMoodleSyncJob(job: Job): Promise<unknown> {
  if (job.name !== MOODLE_SYNC_JOB)
    throw new Error(`Job đồng bộ Moodle không rõ loại: ${job.name}`);
  const run = await runMoodleSync(jobData.parse(job.data).runId);
  return { status: run.status, batchIds: run.batchIds };
}

/** Hết số lần thử → đánh dấu lần đồng bộ lỗi (trang không hiện "đang đồng bộ" mãi). */
export async function onMoodleSyncJobFailed(job: Job | undefined): Promise<void> {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = jobData.safeParse(job.data);
  if (parsed.success) await failMoodleSync(parsed.data.runId, job.failedReason);
}
