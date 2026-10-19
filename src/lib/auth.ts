import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, createAuthMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import pg from 'pg';
import { z } from 'zod';
import { APP_NAME } from './app-config';
import { staffDomainForSamples } from './email-domains';
import { writeAuditLog } from './audit';
import {
  decideNewAuthUser,
  findAccountProfileByEmail,
  linkAuthUserId,
  type SignInErrorCode,
} from './auth-policy';
import { type Env, getEnv, isGoogleConfigured } from './env';
import { logger } from './logger';
import { sendMail } from './mailer';
import { getDataSource } from '@/db/data-source';
import { User } from '@/db/entities/user.entity';
import { UserRole } from '@/db/enums';

/**
 * Better Auth — bảng nằm trong schema `auth` (tạo bởi `npm run db:init`), Pool `pg` riêng
 * với search_path=auth. KHÔNG thêm cột vào bảng auth.*; vai trò/trạng thái ở public.users.
 */

const SESSION_EXPIRES_SECONDS = 8 * 60 * 60;
const ADVISOR_SIGN_UP_PATH = '/sign-up/email';

/** Tài khoản demo đăng nhập nhanh — chỉ khi DEMO_MODE=true (docs/rules/06). */
/** 2 sinh viên demo đăng nhập không cần Google (người dùng chốt 2026-10-13, docs/rules/06). */
export const DEMO_STUDENT_ACCOUNTS = ['KTPM2411903', 'KTPM2411901'] as const;
export const DEMO_ACCOUNTS = ['ADMIN', 'GV001', 'GV002', ...DEMO_STUDENT_ACCOUNTS] as const;
export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

function rejectSignIn(code: SignInErrorCode): APIError {
  return new APIError('FORBIDDEN', { code, message: code });
}

async function auditRejectedSignIn(code: SignInErrorCode, email: string): Promise<void> {
  try {
    const profile = await findAccountProfileByEmail(email);
    await writeAuditLog({
      actorId: profile?.userId ?? null,
      action: 'SIGN_IN_REJECTED',
      targetType: 'AuthAccount',
      targetId: profile?.userId ?? null,
      detail: { code, emailDomain: email.split('@')[1] ?? null },
    });
  } catch (error) {
    logger.error({ err: String(error) }, 'không ghi được audit SIGN_IN_REJECTED');
  }
}

/** Kiểm tra trước khi Better Auth tạo user (Google lần đầu, hoặc đăng ký CVHT). */
async function enforceNewUserPolicy(
  user: { email: string; emailVerified?: boolean },
  path: string | undefined,
  env: Env,
): Promise<void> {
  const profile = await findAccountProfileByEmail(user.email);
  const decision = decideNewAuthUser(
    {
      email: user.email,
      emailVerified: user.emailVerified ?? false,
      isAdvisorRegistration: path === ADVISOR_SIGN_UP_PATH,
    },
    profile,
    env.STAFF_EMAIL_DOMAIN,
  );
  if (!decision.allowed) {
    await auditRejectedSignIn(decision.code, user.email);
    throw rejectSignIn(decision.code);
  }
}

/** Ghi Audit Log khi đăng nhập email/mật khẩu thất bại. */
const auditFailedEmailSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/sign-in/email' || !(ctx.context.returned instanceof APIError)) return;
  const body = z.object({ email: z.string() }).safeParse(ctx.body);
  const email = body.success ? body.data.email : '';
  try {
    const profile = email ? await findAccountProfileByEmail(email) : null;
    await writeAuditLog({
      actorId: profile?.userId ?? null,
      action: 'LOGIN_FAILED',
      targetType: 'AuthAccount',
      targetId: profile?.userId ?? null,
      detail: { status: ctx.context.returned.status, reason: ctx.context.returned.body?.code },
    });
  } catch (error) {
    logger.error({ err: String(error) }, 'không ghi được audit LOGIN_FAILED');
  }
});

/** Chặn đăng ký công khai qua HTTP — đăng ký CVHT chỉ đi qua Server Action (gọi server-side). */
const blockPublicSignUp = createAuthMiddleware(async (ctx) => {
  if (ctx.path === ADVISOR_SIGN_UP_PATH && ctx.request) {
    throw new APIError('FORBIDDEN', { code: 'SIGN_UP_DISABLED', message: 'SIGN_UP_DISABLED' });
  }
  return Promise.resolve();
});

const isDemoStudent = (account: DemoAccount) =>
  (DEMO_STUDENT_ACCOUNTS as readonly string[]).includes(account);

/** Email của tài khoản demo; sinh viên lấy theo hồ sơ đã nhập (không suy ra từ mã — docs/rules/09). */
async function demoAccountEmail(account: DemoAccount, env: Env): Promise<string | null> {
  if (account === 'ADMIN') return env.ADMIN_SEED_EMAIL;
  if (!isDemoStudent(account)) {
    return `${account.toLowerCase()}${staffDomainForSamples(env.STAFF_EMAIL_DOMAIN)}`;
  }
  const user = await (
    await getDataSource()
  )
    .getRepository(User)
    .findOne({ select: { email: true }, where: { userId: account, role: UserRole.STUDENT } });
  return user?.email ?? null;
}

/** POST /api/auth/demo/quick-login — trả 403 khi DEMO_MODE=false (kiểm tra ở server). */
function demoQuickLoginPlugin(env: Env) {
  return {
    id: 'ewars-demo-quick-login',
    endpoints: {
      demoQuickLogin: createAuthEndpoint(
        '/demo/quick-login',
        { method: 'POST', body: z.object({ account: z.enum(DEMO_ACCOUNTS) }) },
        async (ctx) => {
          if (!env.DEMO_MODE) {
            throw new APIError('FORBIDDEN', { code: 'DEMO_DISABLED', message: 'DEMO_DISABLED' });
          }
          const email = await demoAccountEmail(ctx.body.account, env);
          const profile = email ? await findAccountProfileByEmail(email) : null;
          let authUser = email ? await ctx.context.internalAdapter.findUserByEmail(email) : null;
          // Sinh viên demo chưa từng đăng nhập Google: tạo tài khoản đăng nhập (đã có hồ sơ do Admin nhập).
          if (email && profile && !authUser && isDemoStudent(ctx.body.account)) {
            const created = await ctx.context.internalAdapter.createUser(
              { email, name: profile.userId, emailVerified: true },
              ctx,
            );
            await linkAuthUserId(email, created.id);
            authUser = { user: created, accounts: [] };
          }
          if (!profile || !authUser) {
            throw new APIError('NOT_FOUND', {
              code: 'DEMO_ACCOUNT_MISSING',
              message: 'DEMO_ACCOUNT_MISSING',
            });
          }
          const session = await ctx.context.internalAdapter.createSession(authUser.user.id);
          await setSessionCookie(ctx, { session, user: authUser.user });
          await writeAuditLog({
            actorId: profile.userId,
            action: 'DEMO_QUICK_LOGIN',
            targetType: 'AuthAccount',
            targetId: profile.userId,
          });
          return ctx.json({ ok: true });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}

export function buildAuthOptions(env: Env, pool: pg.Pool) {
  return {
    appName: APP_NAME,
    database: pool,
    secret: env.AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    session: { expiresIn: SESSION_EXPIRES_SECONDS, updateAge: 60 * 60 },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: `[${APP_NAME}] Xác minh email đăng ký Cố vấn học tập`,
          text:
            `Kính gửi ${user.name},\n\nVui lòng mở liên kết sau để xác minh email:\n${url}\n\n` +
            'Sau khi xác minh, tài khoản cần Quản trị viên duyệt trước khi sử dụng.',
        });
      },
    },
    socialProviders:
      isGoogleConfigured(env) && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: 'select_account' as const,
            },
          }
        : {},
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    rateLimit: {
      enabled: true,
      storage: 'database' as const,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/demo/quick-login': { window: 60, max: 10 },
      },
    },
    onAPIError: { errorURL: '/login' },
    hooks: { before: blockPublicSignUp, after: auditFailedEmailSignIn },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            await enforceNewUserPolicy(user, ctx?.path, env);
          },
          after: async (user) => {
            await linkAuthUserId(user.email, user.id);
          },
        },
      },
      account: {
        create: {
          // Liên kết Google vào tài khoản đã có: vẫn áp chính sách (CVHT chưa ACTIVE không được dùng Google).
          before: async (account, ctx) => {
            if (account.providerId === 'credential') return;
            const authUser = await ctx?.context.internalAdapter.findUserById(account.userId);
            if (authUser) await enforceNewUserPolicy(authUser, undefined, env);
          },
        },
      },
    },
    plugins: [demoQuickLoginPlugin(env)],
  } satisfies BetterAuthOptions;
}

/** Pool riêng của Better Auth, search_path=auth. */
export function createAuthPool(env: Env): pg.Pool {
  return new pg.Pool({
    connectionString: env.DATABASE_URL,
    options: '-c search_path=auth',
    max: 10,
  });
}

export function createAuth(env: Env = getEnv(), pool: pg.Pool = createAuthPool(env)) {
  return betterAuth(buildAuthOptions(env, pool));
}

export type Auth = ReturnType<typeof createAuth>;

declare global {
  var __ewarsAuth: Auth | undefined;
}

/** Singleton lười — `next build` không cần biến môi trường thật. */
export function getAuth(): Auth {
  globalThis.__ewarsAuth ??= createAuth();
  return globalThis.__ewarsAuth;
}
