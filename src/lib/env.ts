import { z } from 'zod';
import { isStaffEmail } from './email-domains';

/**
 * Biến môi trường phía server — validate bằng Zod (docs/rules/01-architecture.md).
 * Gọi `getEnv()` lúc khởi động (instrumentation.ts, worker, scripts) để crash ngay khi thiếu biến.
 * Không parse ở top-level để `next build` không cần secret thật.
 */

const booleanString = z
  .enum(['true', 'false'], { message: 'Chỉ nhận "true" hoặc "false"' })
  .transform((v) => v === 'true');

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    /** `web` (Next.js, pool 20) hoặc `worker` (BullMQ, pool 10). */
    PROCESS_ROLE: z.enum(['web', 'worker']).default('web'),

    // ── Bắt buộc ───────────────────────────────────────────────
    NEXT_PUBLIC_APP_NAME: z.string().trim().min(1),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET cần ít nhất 32 ký tự'),
    STAFF_EMAIL_DOMAIN: z
      .string()
      .trim()
      .regex(
        /^(\*|@[a-z0-9.-]+\.[a-z]{2,})$/i,
        'Dạng "@ten-mien.edu.vn", hoặc "*" để nhận mọi email (trừ email sinh viên)',
      ),
    ADMIN_SEED_EMAIL: z.email(),
    ADMIN_SEED_PASSWORD: z.string().min(8, 'ADMIN_SEED_PASSWORD cần ít nhất 8 ký tự'),
    DEMO_MODE: booleanString,
    MINIO_ENDPOINT: z.string().trim().min(1),
    MINIO_PORT: z.coerce.number().int().positive(),
    MINIO_USE_SSL: booleanString.default(false),
    MINIO_ACCESS_KEY: z.string().min(3),
    MINIO_SECRET_KEY: z.string().min(8),
    MINIO_BUCKET: z.string().trim().min(3),
    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_FROM: z.string().trim().min(1),

    // ── Tùy chọn ───────────────────────────────────────────────
    BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    /** Bắt buộc khi DEMO_MODE=true (mật khẩu tài khoản CVHT demo do seed:demo tạo). */
    DEMO_ADVISOR_PASSWORD: optionalString,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    /** Trang chính sách dữ liệu cá nhân (docs/rules/04) — trống thì hiện "[Cần nhà trường xác nhận]". */
    PRIVACY_CONTROLLER_NAME: optionalString,
    PRIVACY_CONTACT: optionalString,
    PRIVACY_RETENTION: optionalString,
  })
  .superRefine((env, ctx) => {
    if (!isStaffEmail(env.ADMIN_SEED_EMAIL, env.STAFF_EMAIL_DOMAIN)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_SEED_EMAIL'],
        message: 'Phải là email cán bộ theo STAFF_EMAIL_DOMAIN (không dùng email sinh viên)',
      });
    }
    if (env.DEMO_MODE && (!env.DEMO_ADVISOR_PASSWORD || env.DEMO_ADVISOR_PASSWORD.length < 8)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_ADVISOR_PASSWORD'],
        message: 'Bắt buộc (≥ 8 ký tự) khi DEMO_MODE=true',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parse biến môi trường; ném lỗi liệt kê đủ biến sai/thiếu (không in giá trị). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Biến môi trường không hợp lệ:\n${lines.join('\n')}`);
  }
  return result.data;
}

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Google OAuth chỉ bật khi đủ cả 2 biến (tránh lỗi PROVIDER_NOT_FOUND). */
export function isGoogleConfigured(env: Env = getEnv()): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
