import { type Job } from 'bullmq';
import { z } from 'zod';
import { expireStagedBatches } from '@/modules/data-import/services/import-batch.service';
import {
  failImportBatch,
  loadImportBatch,
  validateImportBatch,
} from '@/modules/data-import/services/import-processor.service';
import { IMPORT_JOB } from '@/modules/data-import/services/import-queue';

const jobData = z.object({ batchId: z.uuid() });

/** Queue `import-batch-process`: kiểm tra lô, nạp lô đã xác nhận, tự hủy lô chờ quá hạn. */
export async function processImportJob(job: Job): Promise<unknown> {
  switch (job.name) {
    case IMPORT_JOB.validate:
      return validateImportBatch(jobData.parse(job.data).batchId);
    case IMPORT_JOB.load:
      return loadImportBatch(jobData.parse(job.data).batchId, { retried: job.attemptsMade > 0 });
    case IMPORT_JOB.expireStaged:
      return expireStagedBatches();
    default:
      throw new Error(`Job nhập không rõ loại: ${job.name}`);
  }
}

/** Hết số lần thử → đánh dấu lô bị từ chối để người dùng biết, không treo "đang kiểm tra" mãi. */
export async function onImportJobFailed(job: Job | undefined): Promise<void> {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = jobData.safeParse(job.data);
  if (parsed.success) await failImportBatch(parsed.data.batchId, job.failedReason);
}
