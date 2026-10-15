import { type Job } from 'bullmq';
import { z } from 'zod';
import {
  failEvaluationRun,
  processEvaluationRun,
} from '@/modules/rule-engine/services/evaluation-run.service';

const jobData = z.object({ runId: z.uuid() });

/** Queue `evaluation-run`: 1 job / EvaluationRun (tự động sau nạp hoặc Admin bấm). */
export async function processEvaluationJob(job: Job): Promise<unknown> {
  return processEvaluationRun(jobData.parse(job.data).runId);
}

/** Hết số lần thử → đánh dấu FAILED để Admin thấy và chạy lại. */
export async function onEvaluationJobFailed(job: Job | undefined): Promise<void> {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = jobData.safeParse(job.data);
  if (parsed.success) await failEvaluationRun(parsed.data.runId, job.failedReason);
}
