import { describe, expect, it } from 'vitest';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { type AccountProfile, decideNewAuthUser } from '@/lib/auth-policy';

const STAFF = '@ctuet.edu.vn';

const profile = (
  role: UserRole,
  accountStatus: UserAccountStatus,
  authUserId: string | null = null,
): AccountProfile => ({ userId: 'X', role, accountStatus, authUserId });

const google = (email: string, emailVerified = true) => ({
  email,
  emailVerified,
  isAdvisorRegistration: false,
});
const registration = (email: string) => ({
  email,
  emailVerified: false,
  isAdvisorRegistration: true,
});

describe('Chính sách tạo tài khoản đăng nhập — không tự tạo hồ sơ', () => {
  it('email ngoài trường → INVALID_DOMAIN', () => {
    expect(decideNewAuthUser(google('a@gmail.com'), null, STAFF)).toEqual({
      allowed: false,
      code: 'INVALID_DOMAIN',
    });
  });

  it('sinh viên chưa có hồ sơ → NO_STUDENT_PROFILE', () => {
    expect(decideNewAuthUser(google('x@student.ctuet.edu.vn'), null, STAFF)).toMatchObject({
      code: 'NO_STUDENT_PROFILE',
    });
  });

  it('sinh viên có hồ sơ ACTIVE, email đã xác minh → cho phép', () => {
    const p = profile(UserRole.STUDENT, UserAccountStatus.ACTIVE);
    expect(decideNewAuthUser(google('x@student.ctuet.edu.vn'), p, STAFF)).toEqual({
      allowed: true,
    });
  });

  it('email Google chưa xác minh → từ chối dù có hồ sơ', () => {
    const p = profile(UserRole.STUDENT, UserAccountStatus.ACTIVE);
    expect(decideNewAuthUser(google('x@student.ctuet.edu.vn', false), p, STAFF)).toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('hồ sơ sinh viên bị khóa → ACCOUNT_INACTIVE', () => {
    const p = profile(UserRole.STUDENT, UserAccountStatus.SUSPENDED);
    expect(decideNewAuthUser(google('x@student.ctuet.edu.vn'), p, STAFF)).toMatchObject({
      code: 'ACCOUNT_INACTIVE',
    });
  });

  it('email cán bộ chưa có tài khoản → STAFF_ACCOUNT_NOT_FOUND', () => {
    expect(decideNewAuthUser(google('gv@ctuet.edu.vn'), null, STAFF)).toMatchObject({
      code: 'STAFF_ACCOUNT_NOT_FOUND',
    });
  });

  it('Google của CVHT chờ duyệt → ACCOUNT_INACTIVE (chỉ ACTIVE mới dùng Google)', () => {
    const p = profile(UserRole.ADVISOR, UserAccountStatus.PENDING_APPROVAL);
    expect(decideNewAuthUser(google('gv@ctuet.edu.vn'), p, STAFF)).toMatchObject({
      code: 'ACCOUNT_INACTIVE',
    });
  });

  it('đăng ký CVHT: chỉ cho hồ sơ ADVISOR chờ duyệt chưa liên kết', () => {
    const fresh = profile(UserRole.ADVISOR, UserAccountStatus.PENDING_APPROVAL);
    expect(decideNewAuthUser(registration('gv@ctuet.edu.vn'), fresh, STAFF)).toEqual({
      allowed: true,
    });

    const linked = profile(UserRole.ADVISOR, UserAccountStatus.PENDING_APPROVAL, 'auth-1');
    expect(decideNewAuthUser(registration('gv@ctuet.edu.vn'), linked, STAFF)).toMatchObject({
      allowed: false,
    });
    const admin = profile(UserRole.ADMIN, UserAccountStatus.ACTIVE);
    expect(decideNewAuthUser(registration('gv@ctuet.edu.vn'), admin, STAFF)).toMatchObject({
      allowed: false,
    });
  });

  it('không thể đăng ký CVHT bằng email sinh viên', () => {
    const p = profile(UserRole.STUDENT, UserAccountStatus.ACTIVE);
    expect(decideNewAuthUser(registration('x@student.ctuet.edu.vn'), p, STAFF)).toMatchObject({
      code: 'INVALID_DOMAIN',
    });
  });
});
