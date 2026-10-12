import { getMigrations } from 'better-auth/db/migration';
import { afterAll, describe, expect, it } from 'vitest';
import { buildAuthOptions, createAuthPool } from '@/lib/auth';
import { getEnv } from '@/lib/env';

/**
 * Bảng auth.* do `npm run db:init` tạo tay — test này bắt lệch schema khi nâng phiên bản Better Auth.
 */
const pool = createAuthPool(getEnv());

afterAll(async () => {
  await pool.end();
});

describe('db:init — bảng Better Auth khớp phiên bản đang dùng', () => {
  it('không thiếu bảng hay cột nào', async () => {
    const { toBeCreated, toBeAdded } = await getMigrations(buildAuthOptions(getEnv(), pool));
    expect(toBeCreated.map((t) => t.table)).toEqual([]);
    expect(toBeAdded.map((t) => `${t.table}: ${Object.keys(t.fields).join(', ')}`)).toEqual([]);
  });
});
