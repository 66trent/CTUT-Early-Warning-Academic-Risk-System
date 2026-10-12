import { IsNull } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { getAuth } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { type AdvisorRegistration } from '../validators/advisor-registration';

export interface RegisteredAdvisorDto {
  staffCode: string;
  email: string;
}

/** Tạo tài khoản đăng nhập (Better Auth) — tách ra để test thay thế được. */
export type CreateCredentials = (input: {
  email: string;
  password: string;
  name: string;
}) => Promise<void>;

const createBetterAuthCredentials: CreateCredentials = async ({ email, password, name }) => {
  await getAuth().api.signUpEmail({
    body: { email, password, name, callbackURL: '/pending-approval' },
  });
};

async function assertNotTaken(staffCode: string, email: string): Promise<void> {
  const repo = (await getDataSource()).getRepository(User);
  if (await repo.existsBy({ userId: staffCode })) {
    throw new AppError('STAFF_CODE_TAKEN', 'Mã cán bộ đã được đăng ký.');
  }
  if (await repo.existsBy({ email })) {
    throw new AppError('EMAIL_TAKEN', 'Email đã được đăng ký.');
  }
}

/**
 * Đăng ký CVHT: luôn `role = ADVISOR`, `accountStatus = PENDING_APPROVAL` (docs/rules/06).
 * Tạo User nghiệp vụ trước (hook Better Auth cần thấy hồ sơ đã commit), rồi tạo tài khoản
 * đăng nhập; lỗi ở bước sau → xóa User vừa tạo (bù trừ) để có thể đăng ký lại.
 */
export async function registerAdvisor(
  input: AdvisorRegistration,
  createCredentials: CreateCredentials = createBetterAuthCredentials,
): Promise<RegisteredAdvisorDto> {
  await assertNotTaken(input.staffCode, input.email);
  const repo = (await getDataSource()).getRepository(User);
  await repo.insert({
    userId: input.staffCode,
    fullName: input.fullName,
    email: input.email,
    role: UserRole.ADVISOR,
    accountStatus: UserAccountStatus.PENDING_APPROVAL,
    authUserId: null,
  });

  try {
    await createCredentials({ email: input.email, password: input.password, name: input.fullName });
  } catch (error) {
    logger.warn({ err: String(error) }, 'đăng ký CVHT lỗi ở bước tạo tài khoản đăng nhập');
    // Chưa liên kết tài khoản đăng nhập → xóa hồ sơ vừa tạo để đăng ký lại được.
    const removed = await repo.delete({ userId: input.staffCode, authUserId: IsNull() });
    if (removed.affected) {
      throw new AppError('REGISTRATION_FAILED', 'Không tạo được tài khoản, vui lòng thử lại.');
    }
    throw new AppError(
      'VERIFICATION_EMAIL_FAILED',
      'Đã tạo tài khoản nhưng chưa gửi được email xác minh. Vui lòng liên hệ Quản trị viên.',
    );
  }

  await writeAuditLog({
    actorId: input.staffCode,
    action: 'ADVISOR_REGISTERED',
    targetType: 'User',
    targetId: input.staffCode,
  });
  return { staffCode: input.staffCode, email: input.email };
}
