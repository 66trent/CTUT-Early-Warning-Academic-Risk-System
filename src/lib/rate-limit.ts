import { Redis } from 'ioredis';
import { getEnv } from './env';

declare global {
  var __ewarsRateLimitRedis: Redis | undefined;
}

function getRedis(): Redis {
  globalThis.__ewarsRateLimitRedis ??= new Redis(getEnv().REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });
  return globalThis.__ewarsRateLimitRedis;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Giới hạn số lần theo cửa sổ cố định (Redis INCR + EXPIRE).
 * Dùng cho thao tác ngoài Better Auth (đăng ký CVHT, nhập file…).
 */
export async function hitRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, windowSeconds);
  if (count <= max) return { allowed: true, retryAfterSeconds: 0 };
  const ttl = await redis.ttl(redisKey);
  return { allowed: false, retryAfterSeconds: Math.max(ttl, 1) };
}

/** IP người gọi từ header reverse proxy; 'unknown' khi không có. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip') || 'unknown';
}
