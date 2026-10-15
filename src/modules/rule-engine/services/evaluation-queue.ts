import { getQueue, QUEUE_NAMES } from '@/lib/queue/queues';

export const EVALUATION_JOB = 'evaluate';
/** Job lặp mỗi đêm: tạo lần chạy cả học kỳ hiện tại (docs/rules/05). */
export const SCHEDULED_EVALUATION_JOB = 'schedule-current-term';

/** Đưa lần chạy vào hàng đợi `evaluation-run`. jobId = id lần chạy → không trùng job. */
export type EvaluationEnqueuer = (runId: string) => Promise<void>;

export const enqueueEvaluationJob: EvaluationEnqueuer = async (runId) => {
  await getQueue(QUEUE_NAMES.evaluationRun).add(EVALUATION_JOB, { runId }, { jobId: runId });
};
