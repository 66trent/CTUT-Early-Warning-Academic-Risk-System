import { Queue, type DefaultJobOptions } from 'bullmq';
import { createRedisConnection } from './connection';

/** 3 queue bắt buộc (docs/rules/01). Job dùng khóa nghiệp vụ làm `jobId` để chống trùng. */
export const QUEUE_NAMES = {
  importBatchProcess: 'import-batch-process',
  /** 1 job / EvaluationRun: RiskScore + 12 luật (2 đường kích hoạt dùng chung — docs/rules/08). */
  evaluationRun: 'evaluation-run',
  sendNotifications: 'send-notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Retry giới hạn + backoff exponential; giữ job lỗi để tra cứu, không để mất âm thầm. */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1_000 },
  removeOnFail: false,
};

declare global {
  var __ewarsQueues: Map<QueueName, Queue> | undefined;
}

/** Queue dùng phía web (thêm job). Cache globalThis để hot-reload không mở thêm kết nối. */
export function getQueue(name: QueueName): Queue {
  globalThis.__ewarsQueues ??= new Map();
  let queue = globalThis.__ewarsQueues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: createRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    globalThis.__ewarsQueues.set(name, queue);
  }
  return queue;
}
