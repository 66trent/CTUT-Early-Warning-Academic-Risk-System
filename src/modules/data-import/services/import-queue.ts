import { getQueue, QUEUE_NAMES } from '@/lib/queue/queues';

export const IMPORT_JOB = {
  validate: 'validate',
  load: 'load',
  expireStaged: 'expire-staged',
} as const;

export interface ImportJobData {
  batchId: string;
}

/** Đưa job vào hàng đợi `import-batch-process`. jobId = id lô (+ hậu tố) → không trùng job. */
export type ImportEnqueuer = (step: 'validate' | 'load', batchId: string) => Promise<void>;

export const enqueueImportJob: ImportEnqueuer = async (step, batchId) => {
  const jobId = step === 'validate' ? batchId : `${batchId}-load`;
  await getQueue(QUEUE_NAMES.importBatchProcess).add(IMPORT_JOB[step], { batchId }, { jobId });
};
