import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { createAuth, createAuthPool, type Auth } from '@/lib/auth';
import { assertScope, type SessionUser } from '@/lib/authz';
import { staffDomainForSamples } from '@/lib/email-domains';
import { type Env, getEnv } from '@/lib/env';
import { ForbiddenError } from '@/lib/errors';
import { changeAccountStatus } from '@/modules/admin/services/account.service';
import { changeClassAdvisor } from '@/modules/admin/services/class.service';
import { registerAdvisor } from '@/modules/admin/services/advisor-registration.service';
import { advisorRegistrationSchema } from '@/modules/admin/validators/advisor-registration';
import { cleanupIdentityFixtures, createIdentityFixtures, FX } from '../helpers/identity-fixtures';

/** DoD Phase 2: duyệt Cố vấn học tập → đăng nhập được và truy cập được sinh viên lớp mình. */
const CODE = 'TSTAPPROVE';
const PASSWORD = 'mat-khau-thu-123';
let env: Env;
let ds: DataSource;
let pool: ReturnType<typeof createAuthPool>;
let auth: Auth;
let email: string;

function signIn(): Promise<Response> {
  return auth.handler(
    new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: env.BETTER_AUTH_URL },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
}

async function sessionUser(): Promise<SessionUser> {
  const user = await ds.getRepository(User).findOneByOrFail({ userId: CODE });
  return {
    userId: user.userId,
    authUserId: user.authUserId ?? '',
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    accountStatus: user.accountStatus,
  };
}

beforeAll(async () => {
  env = getEnv();
  ds = await getDataSource();
  pool = createAuthPool(env);
  auth = createAuth(env, pool);
  await createIdentityFixtures(ds, env.STAFF_EMAIL_DOMAIN);
  email = `${CODE.toLowerCase()}${staffDomainForSamples(env.STAFF_EMAIL_DOMAIN)}`;
  await registerAdvisor(
    advisorRegistrationSchema(env.STAFF_EMAIL_DOMAIN).parse({
      staffCode: CODE,
      fullName: 'Cố vấn chờ duyệt',
      email,
      password: PASSWORD,
      confirmPassword: PASSWORD,
    }),
  );
  // Mô phỏng bấm liên kết xác minh trong email.
  const ctx = await auth.$context;
  const authUser = await ctx.internalAdapter.findUserByEmail(email);
  await ctx.internalAdapter.updateUser(authUser!.user.id, { emailVerified: true });
});

afterAll(async () => {
  await ds.query(`UPDATE administrative_classes SET advisor_id = $1 WHERE class_id = $2`, [
    FX.advisorA,
    FX.classA,
  ]);
  await cleanupIdentityFixtures(ds);
  await pool.end();
  await closeDataSource();
});

describe('Duyệt Cố vấn học tập → đăng nhập và truy cập được', () => {
  it('trước khi duyệt: chưa truy cập được dữ liệu sinh viên', async () => {
    const user = await sessionUser();
    expect(user.accountStatus).toBe(UserAccountStatus.PENDING_APPROVAL);
    await expect(
      assertScope(user, { studentId: FX.studentA, resourceType: 'Student' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('Admin duyệt → đăng nhập email/mật khẩu thành công', async () => {
    await changeAccountStatus(CODE, 'APPROVE', 'ADMIN');
    const response = await signIn();
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('session_token');
    const user = await sessionUser();
    expect(user).toMatchObject({ role: UserRole.ADVISOR, accountStatus: UserAccountStatus.ACTIVE });
  });

  it('được gán lớp → đọc được sinh viên của lớp đó', async () => {
    await changeClassAdvisor({ classId: FX.classA, advisorId: CODE }, 'ADMIN');
    await expect(
      assertScope(await sessionUser(), { studentId: FX.studentA, resourceType: 'Student' }),
    ).resolves.toBeUndefined();
  });

  it('bị khóa → mất quyền ngay dù vẫn còn phiên đăng nhập', async () => {
    await changeClassAdvisor({ classId: FX.classA, advisorId: FX.advisorA }, 'ADMIN');
    await changeAccountStatus(CODE, 'SUSPEND', 'ADMIN');
    await expect(
      assertScope(await sessionUser(), { studentId: FX.studentA, resourceType: 'Student' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
