import { describe, expect, it } from 'vitest';
import { isGoogleConfigured, parseEnv } from '@/lib/env';

const VALID: Record<string, string> = {
  NEXT_PUBLIC_APP_NAME: 'CTUT-EWARS',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_SECRET: 'x'.repeat(32),
  STAFF_EMAIL_DOMAIN: '@ctuet.edu.vn',
  ADMIN_SEED_EMAIL: 'admin@ctuet.edu.vn',
  ADMIN_SEED_PASSWORD: 'admin-password',
  DEMO_MODE: 'false',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'minio',
  MINIO_SECRET_KEY: 'minio-secret',
  MINIO_BUCKET: 'ewars-imports',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'no-reply@ctuet.edu.vn',
};

const without = (key: string) =>
  Object.fromEntries(Object.entries(VALID).filter(([k]) => k !== key));

describe('env — kiểm tra biến môi trường khi khởi động', () => {
  it('chấp nhận cấu hình hợp lệ và áp giá trị mặc định', () => {
    const env = parseEnv(VALID);
    expect(env.DEMO_MODE).toBe(false);
    expect(env.MINIO_PORT).toBe(9000);
    expect(env.MINIO_USE_SSL).toBe(false);
    expect(env.PROCESS_ROLE).toBe('web');
  });

  it.each([
    'DATABASE_URL',
    'REDIS_URL',
    'AUTH_SECRET',
    'STAFF_EMAIL_DOMAIN',
    'ADMIN_SEED_EMAIL',
    'ADMIN_SEED_PASSWORD',
    'DEMO_MODE',
    'NEXT_PUBLIC_APP_NAME',
  ])('ném lỗi nêu tên biến khi thiếu %s', (key) => {
    expect(() => parseEnv(without(key))).toThrow(key);
  });

  it('không in giá trị bí mật trong thông báo lỗi', () => {
    const secret = 'short-secret';
    expect(() => parseEnv({ ...VALID, AUTH_SECRET: secret })).toThrow(/AUTH_SECRET/);
    expect(() => parseEnv({ ...VALID, AUTH_SECRET: secret })).not.toThrow(secret);
  });

  it('STAFF_EMAIL_DOMAIN phải có dạng @ten-mien', () => {
    expect(() => parseEnv({ ...VALID, STAFF_EMAIL_DOMAIN: 'ctuet.edu.vn' })).toThrow(
      'STAFF_EMAIL_DOMAIN',
    );
  });

  it('DEMO_MODE chỉ nhận true/false', () => {
    expect(() => parseEnv({ ...VALID, DEMO_MODE: 'yes' })).toThrow('DEMO_MODE');
  });

  it('DEMO_ADVISOR_PASSWORD bắt buộc khi DEMO_MODE=true', () => {
    expect(() => parseEnv({ ...VALID, DEMO_MODE: 'true' })).toThrow('DEMO_ADVISOR_PASSWORD');
    const env = parseEnv({ ...VALID, DEMO_MODE: 'true', DEMO_ADVISOR_PASSWORD: 'advisor-pw' });
    expect(env.DEMO_MODE).toBe(true);
  });

  it('Google OAuth chỉ bật khi có đủ CLIENT_ID và CLIENT_SECRET', () => {
    expect(isGoogleConfigured(parseEnv(VALID))).toBe(false);
    expect(isGoogleConfigured(parseEnv({ ...VALID, GOOGLE_CLIENT_ID: 'id' }))).toBe(false);
    expect(
      isGoogleConfigured(parseEnv({ ...VALID, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: ' ' })),
    ).toBe(false);
    expect(
      isGoogleConfigured(
        parseEnv({ ...VALID, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }),
      ),
    ).toBe(true);
  });
});

describe('env — STAFF_EMAIL_DOMAIN', () => {
  it('nhận "*" và cho Admin dùng email cá nhân', () => {
    const env = parseEnv({ ...VALID, STAFF_EMAIL_DOMAIN: '*', ADMIN_SEED_EMAIL: 'me@gmail.com' });
    expect(env.STAFF_EMAIL_DOMAIN).toBe('*');
  });

  it('Admin không được dùng email sinh viên', () => {
    expect(() =>
      parseEnv({ ...VALID, STAFF_EMAIL_DOMAIN: '*', ADMIN_SEED_EMAIL: 'a@student.ctuet.edu.vn' }),
    ).toThrow('ADMIN_SEED_EMAIL');
  });

  it('khi giới hạn đuôi, email Admin phải đúng đuôi', () => {
    expect(() => parseEnv({ ...VALID, ADMIN_SEED_EMAIL: 'me@gmail.com' })).toThrow(
      'ADMIN_SEED_EMAIL',
    );
  });
});
