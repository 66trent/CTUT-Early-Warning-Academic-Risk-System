import { Redis } from 'ioredis';
import { getDataSource } from '@/db/data-source';
import { getEnv } from '@/lib/env';

export type ServiceStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded';
  checkedAt: string;
  services: { database: ServiceStatus; redis: ServiceStatus };
}

const TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ]);
}

async function checkDatabase(): Promise<ServiceStatus> {
  try {
    const dataSource = await withTimeout(getDataSource());
    await withTimeout(dataSource.query('SELECT 1'));
    return 'up';
  } catch {
    return 'down';
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const redis = new Redis(getEnv().REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    connectTimeout: TIMEOUT_MS,
    retryStrategy: () => null,
  });
  redis.on('error', () => undefined);
  try {
    await withTimeout(redis.connect());
    return (await withTimeout(redis.ping())) === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  } finally {
    redis.disconnect();
  }
}

/** Kiểm tra DB + Redis. Không trả chi tiết lỗi (tránh lộ thông tin hạ tầng). */
export async function getHealthReport(): Promise<HealthReport> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return {
    status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
    services: { database, redis },
  };
}
