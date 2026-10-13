/**
 * Entry point của BullMQ worker — chạy container riêng, tự khởi tạo DataSource riêng (pool 10).
 * Processor: nhập dữ liệu (Phase 3), đánh giá luật (Phase 4), thông báo (Phase 5).
 */
import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { createRedisConnection } from '@/lib/queue/connection';
import { getQueue, QUEUE_NAMES, type QueueName } from '@/lib/queue/queues';
import { IMPORT_JOB } from '@/modules/data-import/services/import-queue';
import { onEvaluationJobFailed, processEvaluationJob } from './processors/evaluation-run.processor';
import { onImportJobFailed, processImportJob } from './processors/import-batch.processor';
import {
  onNotificationJobFailed,
  processNotificationJob,
} from './processors/notification.processor';

process.env.PROCESS_ROLE = 'worker';

type Processor = (job: Job) => Promise<unknown>;

/**
 * Nhập dữ liệu chạy 1 job/lần: giới hạn bộ nhớ khi đọc XLSX và tránh tranh khóa nạp (docs/rules/05, 12).
 * Đánh giá chạy 1 job/lần: các lần chạy lần lượt, không tranh tài nguyên DB.
 */
const CONCURRENCY: Partial<Record<QueueName, number>> = {
  [QUEUE_NAMES.importBatchProcess]: 1,
  [QUEUE_NAMES.evaluationRun]: 1,
};

const PROCESSORS: Record<QueueName, Processor> = {
  [QUEUE_NAMES.importBatchProcess]: processImportJob,
  [QUEUE_NAMES.evaluationRun]: processEvaluationJob,
  [QUEUE_NAMES.sendNotifications]: processNotificationJob,
};

async function main(): Promise<void> {
  getEnv();
  await getDataSource();

  const workers = Object.entries(PROCESSORS).map(([name, processor]) => {
    const worker = new Worker(name, processor, {
      connection: createRedisConnection(),
      concurrency: CONCURRENCY[name as QueueName] ?? 5,
    });
    worker.on('completed', (job) =>
      logger.info({ queue: name, jobId: job.id, ms: Date.now() - job.timestamp }, 'job xong'),
    );
    worker.on('failed', (job, error) => {
      logger.error({ queue: name, jobId: job?.id, err: error.message }, 'job lỗi');
      const onFailed =
        name === QUEUE_NAMES.importBatchProcess
          ? onImportJobFailed
          : name === QUEUE_NAMES.evaluationRun
            ? onEvaluationJobFailed
            : onNotificationJobFailed;
      onFailed?.(job).catch((e: unknown) =>
        logger.error({ queue: name, err: String(e) }, 'không đánh dấu được job lỗi'),
      );
    });
    return worker;
  });
  // Tự hủy lô chờ xác nhận quá 7 ngày — mỗi ngày 2h sáng (docs/rules/12).
  await getQueue(QUEUE_NAMES.importBatchProcess).upsertJobScheduler(
    IMPORT_JOB.expireStaged,
    { pattern: '0 2 * * *', tz: 'Asia/Ho_Chi_Minh' },
    { name: IMPORT_JOB.expireStaged },
  );
  logger.info({ queues: Object.keys(PROCESSORS) }, 'worker đã sẵn sàng');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker đang dừng');
    await Promise.all(workers.map((w) => w.close()));
    await closeDataSource();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.fatal(
    { err: error instanceof Error ? error.message : error },
    'worker không khởi động được',
  );
  process.exit(1);
});
