import { type APIError } from 'better-auth/api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { createAuth, createAuthPool, type Auth } from '@/lib/auth';
import { type Env, getEnv } from '@/lib/env';
import {
  cleanupIdentityFixtures,
  countByEmail,
  createIdentityFixtures,
  FX,
  staffEmail,
} from '../helpers/identity-fixtures';

/**
 * DoD Phase 1 — chạy với PostgreSQL thật (đã `db:init` + `migration:run`).
 * Mô phỏng đăng nhập Google lần đầu bằng `internalAdapter.createUser` (chạy đúng databaseHooks).
 */
let env: Env;
let ds: DataSource;
let pool: ReturnType<typeof createAuthPool>;
let auth: Auth;

async function createOAuthUser(email: string, emailVerified = true) {
  const ctx = await auth.$context;
  return ctx.internalAdapter.createUser(
    { email, name: 'Người thử', emailVerified },
    { method: 'oauth' },
  );
}

async function expectRejected(promise: Promise<unknown>, code: string) {
  const error = (await promise.then(
    () => null,
    (e: unknown) => e,
  )) as APIError | null;
  expect(error, `phải bị từ chối với ${code}`).not.toBeNull();
  expect(error?.body?.code).toBe(code);
}

function authRequest(path: string, body: unknown, origin = env.BETTER_AUTH_URL): Request {
  return new Request(`${env.BETTER_AUTH_URL}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  env = getEnv();
  ds = await getDataSource();
  pool = createAuthPool(env);
  auth = createAuth(env, pool);
  await createIdentityFixtures(ds, env.STAFF_EMAIL_DOMAIN);
});

afterAll(async () => {
  await cleanupIdentityFixtures(ds);
  await pool.end();
  await closeDataSource();
});

describe('Đăng nhập Google — từ chối và KHÔNG phát sinh bản ghi', () => {
  it('email sinh viên chưa có hồ sơ → NO_STUDENT_PROFILE', async () => {
    const email = 'tst_ghost@student.ctuet.edu.vn';
    await expectRejected(createOAuthUser(email), 'NO_STUDENT_PROFILE');
    expect(await countByEmail(ds, email)).toEqual({ authUsers: 0, users: 0 });
  });

  it.runIf(getEnv().STAFF_EMAIL_DOMAIN !== '*')('email ngoài trường → INVALID_DOMAIN', async () => {
    const email = 'tst_outsider@gmail.com';
    await expectRejected(createOAuthUser(email), 'INVALID_DOMAIN');
    expect(await countByEmail(ds, email)).toEqual({ authUsers: 0, users: 0 });
  });

  it('email cán bộ chưa có tài khoản → STAFF_ACCOUNT_NOT_FOUND', async () => {
    const email = staffEmail('tst_nobody', env.STAFF_EMAIL_DOMAIN);
    await expectRejected(createOAuthUser(email), 'STAFF_ACCOUNT_NOT_FOUND');
    expect(await countByEmail(ds, email)).toEqual({ authUsers: 0, users: 0 });
  });

  it('CVHT đang chờ duyệt không đăng nhập Google được → ACCOUNT_INACTIVE', async () => {
    const email = staffEmail(FX.advisorPending, env.STAFF_EMAIL_DOMAIN);
    await expectRejected(createOAuthUser(email), 'ACCOUNT_INACTIVE');
    expect((await countByEmail(ds, email)).authUsers).toBe(0);
  });

  it('lần từ chối được ghi Audit Log', async () => {
    const [row] = await ds.query<{ n: string }[]>(
      `SELECT count(*) AS n FROM audit_logs WHERE action = 'SIGN_IN_REJECTED' AND target_id = $1`,
      [FX.advisorPending],
    );
    expect(Number(row?.n)).toBeGreaterThanOrEqual(1);
  });

  it('sinh viên đã được nhập hồ sơ → tạo tài khoản và gắn authUserId', async () => {
    const created = await createOAuthUser(FX.studentAEmail);
    const [row] = await ds.query<{ auth_user_id: string }[]>(
      `SELECT auth_user_id FROM users WHERE user_id = $1`,
      [FX.studentA],
    );
    expect(row?.auth_user_id).toBe(created.id);
  });
});

describe('Endpoint Better Auth', () => {
  it('đăng ký công khai qua HTTP bị chặn (chỉ đăng ký qua form Cố vấn học tập)', async () => {
    const response = await auth.handler(
      authRequest('/sign-up/email', {
        email: staffEmail('tst_hacker', env.STAFF_EMAIL_DOMAIN),
        password: 'password-123',
        name: 'x',
      }),
    );
    expect(response.status).toBe(403);
  });

  it('DEMO_MODE=false → đăng nhập nhanh trả 403', async () => {
    const demoOffPool = createAuthPool(env);
    const demoOff = createAuth({ ...env, DEMO_MODE: false }, demoOffPool);
    try {
      const response = await demoOff.handler(
        authRequest('/demo/quick-login', { account: 'ADMIN' }),
      );
      expect(response.status).toBe(403);
      expect(response.headers.get('set-cookie')).toBeNull();
    } finally {
      await demoOffPool.end();
    }
  });

  it.runIf(getEnv().DEMO_MODE)('DEMO_MODE=true → đăng nhập nhanh Admin tạo phiên', async () => {
    const response = await auth.handler(authRequest('/demo/quick-login', { account: 'ADMIN' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('session_token');
  });

  it('đăng nhập sai mật khẩu → ghi Audit Log LOGIN_FAILED', async () => {
    const before = await ds.query<{ n: string }[]>(
      `SELECT count(*) AS n FROM audit_logs WHERE action = 'LOGIN_FAILED'`,
    );
    const response = await auth.handler(
      authRequest('/sign-in/email', { email: env.ADMIN_SEED_EMAIL, password: 'sai-mat-khau-123' }),
    );
    expect(response.status).toBe(401);
    const after = await ds.query<{ n: string }[]>(
      `SELECT count(*) AS n FROM audit_logs WHERE action = 'LOGIN_FAILED'`,
    );
    expect(Number(after[0]?.n)).toBe(Number(before[0]?.n) + 1);
  });
});
