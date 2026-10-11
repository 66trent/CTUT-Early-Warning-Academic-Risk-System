import { Redis } from 'ioredis';
import { getEnv } from '@/lib/env';

/**
 * Kết nối Redis cho BullMQ. `maxRetriesPerRequest: null` là yêu cầu của BullMQ Worker.
 * Mỗi lời gọi tạo kết nối mới — BullMQ quản lý vòng đời kết nối của Queue/Worker.
 */
export function createRedisConnection(): Redis {
  return new Redis(getEnv().REDIS_URL, { maxRetriesPerRequest: null });
}
