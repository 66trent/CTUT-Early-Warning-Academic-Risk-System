import { getDataSource } from '@/db/data-source';
import { STUDENT_EMAIL_DOMAIN, User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';

/**
 * Chính sách cho phép tạo/liên kết tài khoản đăng nhập (docs/rules/01, 06, 09).
 * KHÔNG BAO GIỜ tự tạo User/Student; KHÔNG suy ra mã sinh viên từ email.
 */

/** Mã lỗi cố định — trang /login ánh xạ sang lời văn tiếng Việt. */
export const SIGN_IN_ERROR_CODES = [
  'INVALID_DOMAIN',
  'NO_STUDENT_PROFILE',
  'STAFF_ACCOUNT_NOT_FOUND',
  'ACCOUNT_INACTIVE',
  'EMAIL_NOT_VERIFIED',
] as const;
export type SignInErrorCode = (typeof SIGN_IN_ERROR_CODES)[number];

export interface AccountProfile {
  userId: string;
  role: UserRole;
  accountStatus: UserAccountStatus;
  authUserId: string | null;
}

export interface NewAuthUserRequest {
  email: string;
  emailVerified: boolean;
  /** true khi tạo qua Server Action đăng ký CVHT (không phải đăng nhập Google). */
  isAdvisorRegistration: boolean;
}

export type PolicyDecision = { allowed: true } | { allowed: false; code: SignInErrorCode };

const deny = (code: SignInErrorCode): PolicyDecision => ({ allowed: false, code });

/** Quyết định thuần — test được không cần DB. */
export function decideNewAuthUser(
  request: NewAuthUserRequest,
  profile: AccountProfile | null,
  staffEmailDomain: string,
): PolicyDecision {
  const email = request.email.trim().toLowerCase();

  if (email.endsWith(STUDENT_EMAIL_DOMAIN)) {
    if (request.isAdvisorRegistration) return deny('INVALID_DOMAIN');
    if (!request.emailVerified) return deny('EMAIL_NOT_VERIFIED');
    if (!profile || profile.role !== UserRole.STUDENT) return deny('NO_STUDENT_PROFILE');
    if (profile.accountStatus !== UserAccountStatus.ACTIVE) return deny('ACCOUNT_INACTIVE');
    return { allowed: true };
  }

  if (email.endsWith(staffEmailDomain.toLowerCase())) {
    if (!profile || profile.role === UserRole.STUDENT) return deny('STAFF_ACCOUNT_NOT_FOUND');
    if (request.isAdvisorRegistration) {
      const isFreshRegistration =
        profile.role === UserRole.ADVISOR &&
        profile.accountStatus === UserAccountStatus.PENDING_APPROVAL &&
        profile.authUserId === null;
      return isFreshRegistration ? { allowed: true } : deny('STAFF_ACCOUNT_NOT_FOUND');
    }
    if (!request.emailVerified) return deny('EMAIL_NOT_VERIFIED');
    if (profile.accountStatus !== UserAccountStatus.ACTIVE) return deny('ACCOUNT_INACTIVE');
    return { allowed: true };
  }

  return deny('INVALID_DOMAIN');
}

/** Hồ sơ nghiệp vụ theo email (email luôn lưu chữ thường). */
export async function findAccountProfileByEmail(email: string): Promise<AccountProfile | null> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(User).findOne({
    select: { userId: true, role: true, accountStatus: true, authUserId: true },
    where: { email: email.trim().toLowerCase() },
  });
}

/** Gắn id Better Auth vào User — idempotent (chỉ khi còn NULL). */
export async function linkAuthUserId(email: string, authUserId: string): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource
    .createQueryBuilder()
    .update(User)
    .set({ authUserId })
    .where('email = :email AND auth_user_id IS NULL', { email: email.trim().toLowerCase() })
    .execute();
}
