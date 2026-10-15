import { describe, expect, it } from 'vitest';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { isWithinScope, type SessionUser } from '@/lib/authz';

const user = (
  role: UserRole,
  userId: string,
  accountStatus = UserAccountStatus.ACTIVE,
): SessionUser => ({
  userId,
  authUserId: `auth-${userId}`,
  role,
  fullName: userId,
  email: `${userId}@x`,
  accountStatus,
});

describe('assertScope — ma trận phạm vi', () => {
  it('sinh viên chỉ đọc dữ liệu của chính mình', () => {
    const sv = user(UserRole.STUDENT, 'SV1');
    expect(isWithinScope(sv, { studentId: 'SV1', resourceType: 'Alert' }, null)).toBe(true);
    expect(isWithinScope(sv, { studentId: 'SV2', resourceType: 'Alert' }, null)).toBe(false);
    expect(
      isWithinScope(sv, { studentId: 'SV1', resourceType: 'Alert', action: 'PROCESS' }, null),
    ).toBe(false);
  });

  it('CVHT chỉ thấy sinh viên thuộc lớp mình phụ trách', () => {
    const gv = user(UserRole.ADVISOR, 'GV1');
    expect(isWithinScope(gv, { studentId: 'SV1', resourceType: 'Alert' }, 'GV1')).toBe(true);
    expect(isWithinScope(gv, { studentId: 'SV1', resourceType: 'Alert' }, 'GV2')).toBe(false);
    expect(isWithinScope(gv, { studentId: 'SV1', resourceType: 'Alert' }, null)).toBe(false);
    expect(isWithinScope(gv, { studentId: 'SV?', resourceType: 'Alert' }, undefined)).toBe(false);
  });

  it('Admin đọc được mọi sinh viên nhưng không xử lý cảnh báo', () => {
    const admin = user(UserRole.ADMIN, 'ADMIN');
    expect(isWithinScope(admin, { studentId: 'SV1', resourceType: 'Alert' }, 'GV1')).toBe(true);
    expect(
      isWithinScope(admin, { studentId: 'SV1', resourceType: 'Alert', action: 'PROCESS' }, 'GV1'),
    ).toBe(false);
  });

  it.each([
    UserAccountStatus.PENDING_APPROVAL,
    UserAccountStatus.REJECTED,
    UserAccountStatus.SUSPENDED,
  ])('tài khoản %s bị chặn mọi dữ liệu', (status) => {
    const gv = user(UserRole.ADVISOR, 'GV1', status);
    expect(isWithinScope(gv, { studentId: 'SV1', resourceType: 'Student' }, 'GV1')).toBe(false);
  });
});
