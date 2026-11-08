import { type Job } from 'bullmq';
import { z } from 'zod';
import { SCHEDULED_EVALUATION_JOB } from '@/modules/rule-engine/services/evaluation-queue';
import {
  failEvaluationRun,
  processEvaluationRun,
  requestScheduledEvaluation,
} from '@/modules/rule-engine/services/evaluation-run.service';

const jobData = z.object({ runId: z.uuid() });

/**
 * Queue `evaluation-run`: 1 job / EvaluationRun (tự động sau nạp, Admin bấm, theo lịch). Job lặp
 * mỗi đêm chỉ TẠO lần chạy rồi đưa job thường vào hàng đợi.
 */
export async function processEvaluationJob(job: Job): Promise<unknown> {
  if (job.name === SCHEDULED_EVALUATION_JOB) return requestScheduledEvaluation();
  return processEvaluationRun(jobData.parse(job.data).runId);
}

/** Hết số lần thử → đánh dấu FAILED để Admin thấy và chạy lại. */
export async function onEvaluationJobFailed(job: Job | undefined): Promise<void> {
  if (!job || job.name === SCHEDULED_EVALUATION_JOB) return;
  if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = jobData.safeParse(job.data);
  if (parsed.success) await failEvaluationRun(parsed.data.runId, job.failedReason);
}
