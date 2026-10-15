import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDataSource } from '@/db/data-source';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { getAuth } from './auth';
import { linkAuthUserId } from './auth-policy';
import { type SessionUser } from './authz';
import { ForbiddenError } from './errors';

export type AuthState =
  | { kind: 'anonymous' }
  /** Có phiên đăng nhập nhưng không có hồ sơ nghiệp vụ (KHÔNG tự tạo). */
  | { kind: 'no-profile' }
  | { kind: 'signed-in'; user: SessionUser };

const HOME_BY_ROLE: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.ADVISOR]: '/advisor',
  [UserRole.STUDENT]: '/student',
};

export function homePathFor(role: UserRole): string {
  return HOME_BY_ROLE[role];
}

/**
 * Đọc phiên + entity User (vai trò, trạng thái) ở server, 1 lần/request nhờ React.cache().
 * Chỉ ĐỌC; ngoại lệ duy nhất: gắn authUserId khi tìm thấy theo email (idempotent).
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { kind: 'anonymous' };

  const repo = (await getDataSource()).getRepository(User);
  let user = await repo.findOneBy({ authUserId: session.user.id });
  if (!user) {
    user = await repo.findOneBy({ email: session.user.email.toLowerCase() });
    if (!user || (user.authUserId !== null && user.authUserId !== session.user.id)) {
      return { kind: 'no-profile' };
    }
    await linkAuthUserId(user.email, session.user.id);
  }

  return {
    kind: 'signed-in',
    user: {
      userId: user.userId,
      authUserId: session.user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      accountStatus: user.accountStatus,
    },
  };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const state = await getAuthState();
  return state.kind === 'signed-in' ? state.user : null;
}

/**
 * Dùng trong layout/page: chưa đăng nhập → /login; chưa có hồ sơ → /no-profile;
 * tài khoản chưa ACTIVE → /pending-approval; sai vai trò → trang chủ của vai trò.
 */
export async function requireUser(roles?: readonly UserRole[]): Promise<SessionUser> {
  const state = await getAuthState();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'no-profile') redirect('/no-profile');
  const { user } = state;
  if (user.accountStatus !== UserAccountStatus.ACTIVE) redirect('/pending-approval');
  if (roles && !roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** Dùng trong Server Action: ném ForbiddenError thay vì chuyển trang. */
export async function requireActionUser(roles?: readonly UserRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.accountStatus !== UserAccountStatus.ACTIVE) throw new ForbiddenError();
  if (roles && !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}
