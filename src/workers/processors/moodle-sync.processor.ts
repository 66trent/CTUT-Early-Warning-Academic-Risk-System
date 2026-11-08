import { type Job } from 'bullmq';
import { z } from 'zod';
import {
  flushMoodleEvents,
  pollMoodleCourses,
  pruneMoodleEventInbox,
  runMoodleDueJob,
  runNightlyMoodleSync,
} from '@/modules/data-import/services/moodle-auto.service';
import { MOODLE_JOB } from '@/modules/data-import/services/moodle-queue';
import { failMoodleSync, runMoodleSync } from '@/modules/data-import/services/moodle-sync.service';

const runData = z.object({ runId: z.uuid() });
const flushData = z.object({ termId: z.string().min(1).max(10) });
const dueData = z.object({
  linkId: z.uuid(),
  kind: z.enum(['QUIZ', 'ASSIGNMENT']),
  activityId: z.number().int(),
  dueAt: z.number().int(),
});

/** Queue `moodle-sync` (docs/rules/12): lần đồng bộ, gom sự kiện, lịch 10 phút / đêm, hạn nộp. */
export async function processMoodleSyncJob(job: Job): Promise<unknown> {
  switch (job.name) {
    case MOODLE_JOB.run: {
      const run = await runMoodleSync(runData.parse(job.data).runId);
      return { status: run.status, batchIds: run.batchIds };
    }
    case MOODLE_JOB.flush: {
      const run = await flushMoodleEvents(flushData.parse(job.data).termId);
      return run ? { runId: run.id, status: run.status } : { skipped: 'không có sự kiện' };
    }
    case MOODLE_JOB.poll:
      return { runs: (await pollMoodleCourses()).map((r) => r.id) };
    case MOODLE_JOB.nightly: {
      const runs = await runNightlyMoodleSync();
      return { runs: runs.map((r) => r.id), pruned: await pruneMoodleEventInbox() };
    }
    case MOODLE_JOB.due:
      return runMoodleDueJob(dueData.parse(job.data));
    default:
      throw new Error(`Job đồng bộ Moodle không rõ loại: ${job.name}`);
  }
}

/** Hết số lần thử → đánh dấu lần đồng bộ lỗi (trang không hiện "đang đồng bộ" mãi). */
export async function onMoodleSyncJobFailed(job: Job | undefined): Promise<void> {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = runData.safeParse(job.data);
  if (parsed.success) await failMoodleSync(parsed.data.runId, job.failedReason);
}
