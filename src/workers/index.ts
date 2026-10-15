/**
 * Entry point của BullMQ worker — chạy container riêng, tự khởi tạo DataSource riêng (pool 10).
 * Processor cho từng queue được thêm ở Phase 3 (import), 4 (rule engine), 5 (thông báo).
 */
import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { createRedisConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES, type QueueName } from '@/lib/queue/queues';

process.env.PROCESS_ROLE = 'worker';

type Processor = (job: Job) => Promise<unknown>;

/** Chưa có processor: job bị đánh lỗi rõ ràng thay vì biến mất âm thầm. */
const notImplemented =
  (queue: QueueName): Processor =>
  (job) =>
    Promise.reject(new Error(`Queue "${queue}" chưa có processor (job ${job.id ?? '?'})`));

const PROCESSORS: Record<QueueName, Processor> = {
  [QUEUE_NAMES.importBatchProcess]: notImplemented(QUEUE_NAMES.importBatchProcess),
  [QUEUE_NAMES.calculateRiskScore]: notImplemented(QUEUE_NAMES.calculateRiskScore),
  [QUEUE_NAMES.evaluateHardTriggers]: notImplemented(QUEUE_NAMES.evaluateHardTriggers),
  [QUEUE_NAMES.sendNotifications]: notImplemented(QUEUE_NAMES.sendNotifications),
};

async function main(): Promise<void> {
  getEnv();
  await getDataSource();

  const workers = Object.entries(PROCESSORS).map(([name, processor]) => {
    const worker = new Worker(name, processor, {
      connection: createRedisConnection(),
      concurrency: 5,
    });
    worker.on('completed', (job) =>
      logger.info({ queue: name, jobId: job.id, ms: Date.now() - job.timestamp }, 'job xong'),
    );
    worker.on('failed', (job, error) =>
      logger.error({ queue: name, jobId: job?.id, err: error.message }, 'job lỗi'),
    );
    return worker;
  });
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
