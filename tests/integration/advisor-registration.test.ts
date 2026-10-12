import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { staffDomainForSamples } from '@/lib/email-domains';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { registerAdvisor } from '@/modules/admin/services/advisor-registration.service';
import { advisorRegistrationSchema } from '@/modules/admin/validators/advisor-registration';
import { cleanupIdentityFixtures, countByEmail } from '../helpers/identity-fixtures';

let ds: DataSource;
const domain = () => getEnv().STAFF_EMAIL_DOMAIN;
const sampleDomain = () => staffDomainForSamples(domain());

const input = (code: string) =>
  advisorRegistrationSchema(domain()).parse({
    staffCode: code,
    fullName: 'Cố vấn thử',
    email: `${code.toLowerCase()}${sampleDomain()}`,
    password: 'mat-khau-thu-123',
    confirmPassword: 'mat-khau-thu-123',
  });

beforeAll(async () => {
  ds = await getDataSource();
  await cleanupIdentityFixtures(ds);
});

afterAll(async () => {
  await cleanupIdentityFixtures(ds);
  await closeDataSource();
});

describe('Đăng ký Cố vấn học tập', () => {
  it('form không có trường vai trò; email phải đúng đuôi cán bộ', () => {
    const schema = advisorRegistrationSchema(domain());
    const bad = schema.safeParse({
      ...input('TSTREG0'),
      email: 'tst@student.ctuet.edu.vn',
      role: 'ADMIN',
    });
    expect(bad.success).toBe(false);
    const ok = schema.parse({ ...input('TSTREG0'), role: 'ADMIN' });
    expect(ok).not.toHaveProperty('role');
  });

  it('tạo ADVISOR ở trạng thái PENDING_APPROVAL và tài khoản đăng nhập (gửi email xác minh)', async () => {
    const data = input('TSTREG1');
    await registerAdvisor(data);
    const user = await ds.getRepository(User).findOneByOrFail({ userId: 'TSTREG1' });
    expect(user.role).toBe(UserRole.ADVISOR);
    expect(user.accountStatus).toBe(UserAccountStatus.PENDING_APPROVAL);
    expect(user.authUserId).not.toBeNull();
    expect((await countByEmail(ds, data.email)).authUsers).toBe(1);
  });

  it('mã cán bộ hoặc email trùng → từ chối', async () => {
    await expect(registerAdvisor(input('TSTREG1'))).rejects.toMatchObject({
      code: 'STAFF_CODE_TAKEN',
    });
  });

  it('tạo tài khoản đăng nhập lỗi → xóa hồ sơ vừa tạo để đăng ký lại được', async () => {
    const failing = () => Promise.reject(new Error('smtp down'));
    await expect(registerAdvisor(input('TSTREG2'), failing)).rejects.toBeInstanceOf(AppError);
    expect(await ds.getRepository(User).existsBy({ userId: 'TSTREG2' })).toBe(false);
  });
});
