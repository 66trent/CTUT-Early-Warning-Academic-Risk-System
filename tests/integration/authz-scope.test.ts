import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { assertScope, type SessionUser } from '@/lib/authz';
import { getEnv } from '@/lib/env';
import { ForbiddenError } from '@/lib/errors';
import { cleanupIdentityFixtures, createIdentityFixtures, FX } from '../helpers/identity-fixtures';

let ds: DataSource;

const sessionUser = (
  userId: string,
  role: UserRole,
  accountStatus = UserAccountStatus.ACTIVE,
): SessionUser => ({
  userId,
  authUserId: `auth-${userId}`,
  role,
  fullName: userId,
  email: `${userId}@test`,
  accountStatus,
});

beforeAll(async () => {
  ds = await getDataSource();
  await createIdentityFixtures(ds, getEnv().STAFF_EMAIL_DOMAIN);
});

afterAll(async () => {
  await cleanupIdentityFixtures(ds);
  await closeDataSource();
});

describe('Phân quyền theo phạm vi qua lớp sinh hoạt (DB thật)', () => {
  const advisorA = sessionUser(FX.advisorA, UserRole.ADVISOR);

  it('CVHT A đọc được sinh viên lớp mình', async () => {
    await expect(
      assertScope(advisorA, { studentId: FX.studentA, resourceType: 'Student' }),
    ).resolves.toBeUndefined();
  });

  it('CVHT A KHÔNG đọc được sinh viên lớp của CVHT B', async () => {
    await expect(
      assertScope(advisorA, { studentId: FX.studentB, resourceType: 'Student' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('mã sinh viên không tồn tại → cùng lỗi không có quyền (không lộ tồn tại)', async () => {
    await expect(
      assertScope(advisorA, { studentId: 'TST_NOPE', resourceType: 'Student' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('CVHT chờ duyệt bị chặn mọi dữ liệu', async () => {
    const pending = sessionUser(
      FX.advisorPending,
      UserRole.ADVISOR,
      UserAccountStatus.PENDING_APPROVAL,
    );
    await expect(
      assertScope(pending, { studentId: FX.studentA, resourceType: 'Student' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('đổi CVHT của lớp → CVHT cũ mất quyền ngay', async () => {
    await ds.query(`UPDATE administrative_classes SET advisor_id = $1 WHERE class_id = $2`, [
      FX.advisorB,
      FX.classA,
    ]);
    await expect(
      assertScope(advisorA, { studentId: FX.studentA, resourceType: 'Student' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await ds.query(`UPDATE administrative_classes SET advisor_id = $1 WHERE class_id = $2`, [
      FX.advisorA,
      FX.classA,
    ]);
  });

  it('sinh viên chỉ đọc chính mình; Admin đọc được nhưng không xử lý cảnh báo', async () => {
    const student = sessionUser(FX.studentA, UserRole.STUDENT);
    await expect(
      assertScope(student, { studentId: FX.studentB, resourceType: 'Alert' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const admin = sessionUser('ADMIN', UserRole.ADMIN);
    await expect(
      assertScope(admin, { studentId: FX.studentB, resourceType: 'Alert' }),
    ).resolves.toBeUndefined();
    await expect(
      assertScope(admin, { studentId: FX.studentB, resourceType: 'Alert', action: 'PROCESS' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
