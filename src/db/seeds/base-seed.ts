import { type DataSource } from 'typeorm';
import { type Auth } from '@/lib/auth';
import { type Env } from '@/lib/env';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { UserAccountStatus, UserRole } from '../enums';
import { seedRules } from '@/modules/rule-engine/services/rule-config.service';
import { DEPARTMENTS } from './departments';

/** Mã cán bộ của Admin đầu tiên (Admin khác do Admin tạo). */
export const SEED_ADMIN_USER_ID = 'ADMIN';

export interface SeedReport {
  departments: number;
  adminCreated: boolean;
  rulesCreated: number;
}

async function seedDepartments(dataSource: DataSource): Promise<number> {
  await dataSource.getRepository(Department).upsert([...DEPARTMENTS], ['departmentId']);
  return DEPARTMENTS.length;
}

/**
 * Tạo (nếu chưa có) 1 tài khoản cán bộ ACTIVE kèm mật khẩu — dùng cho Admin seed và CVHT demo.
 * Mật khẩu hash bằng cơ chế mặc định của Better Auth. Đã có thì giữ nguyên (không đổi mật khẩu).
 */
export async function ensureStaffAccount(
  dataSource: DataSource,
  auth: Auth,
  account: { userId: string; fullName: string; email: string; role: UserRole; password: string },
): Promise<boolean> {
  const email = account.email.toLowerCase();
  const repo = dataSource.getRepository(User);
  if (!(await repo.existsBy({ userId: account.userId }))) {
    await repo.insert({
      userId: account.userId,
      fullName: account.fullName,
      email,
      role: account.role,
      accountStatus: UserAccountStatus.ACTIVE,
      authUserId: null,
    });
  }

  const ctx = await auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) return false;
  const authUser = await ctx.internalAdapter.createUser(
    {
      email,
      name: account.fullName,
      emailVerified: true,
    },
    { method: 'admin' },
  );
  await ctx.internalAdapter.linkAccount({
    userId: authUser.id,
    providerId: 'credential',
    accountId: authUser.id,
    password: await ctx.password.hash(account.password),
  });
  return true;
}

export async function seedBase(dataSource: DataSource, auth: Auth, env: Env): Promise<SeedReport> {
  const departments = await seedDepartments(dataSource);
  const adminCreated = await ensureStaffAccount(dataSource, auth, {
    userId: SEED_ADMIN_USER_ID,
    fullName: 'Quản trị viên',
    email: env.ADMIN_SEED_EMAIL,
    role: UserRole.ADMIN,
    password: env.ADMIN_SEED_PASSWORD,
  });
  // 10 luật + RISK-SCORE với ngưỡng mặc định (docs/rules/08) — cần Admin làm người cấu hình.
  const rulesCreated = await dataSource.transaction((em) => seedRules(em, SEED_ADMIN_USER_ID));
  return { departments, adminCreated, rulesCreated };
}
