import { type EntityManager, In } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { type AuditAction, writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { applyOrder, firstPage, type ListParams, type Paged, pageOffset } from '@/lib/list-params';
import { type AccountFilter, type AccountStatusAction } from '../validators/account';

export interface AccountDto {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  accountStatus: UserAccountStatus;
  /** null = chưa có tài khoản đăng nhập (VD sinh viên chưa đăng nhập lần nào). */
  emailVerified: boolean | null;
  advisedClassCount: number;
}

export type AccountPageDto = Paged<AccountDto>;

export const ACCOUNT_SORT_KEYS = ['userId', 'fullName', 'role', 'accountStatus'] as const;
export type AccountSortKey = (typeof ACCOUNT_SORT_KEYS)[number];
const ACCOUNT_SORT_COLUMNS: Record<AccountSortKey, string> = {
  userId: 'u.userId',
  fullName: 'u.fullName',
  role: 'u.role',
  accountStatus: 'u.accountStatus',
};

/** Chuyển trạng thái hợp lệ (docs/rules/00, 06). */
const STATUS_TRANSITIONS: Record<
  AccountStatusAction,
  { from: UserAccountStatus; to: UserAccountStatus; audit: AuditAction }
> = {
  APPROVE: {
    from: UserAccountStatus.PENDING_APPROVAL,
    to: UserAccountStatus.ACTIVE,
    audit: 'ACCOUNT_APPROVED',
  },
  REJECT: {
    from: UserAccountStatus.PENDING_APPROVAL,
    to: UserAccountStatus.REJECTED,
    audit: 'ACCOUNT_REJECTED',
  },
  SUSPEND: {
    from: UserAccountStatus.ACTIVE,
    to: UserAccountStatus.SUSPENDED,
    audit: 'ACCOUNT_SUSPENDED',
  },
  REACTIVATE: {
    from: UserAccountStatus.SUSPENDED,
    to: UserAccountStatus.ACTIVE,
    audit: 'ACCOUNT_REACTIVATED',
  },
};

const STAFF_ROLES = [UserRole.ADVISOR, UserRole.ADMIN];

/** Email đã xác minh — đọc bảng của Better Auth (schema auth), chỉ đọc. */
async function loadEmailVerified(
  em: EntityManager,
  authUserIds: string[],
): Promise<Map<string, boolean>> {
  if (authUserIds.length === 0) return new Map();
  const rows = await em.query<{ id: string; emailVerified: boolean }[]>(
    'SELECT id, "emailVerified" FROM auth."user" WHERE id = ANY($1)',
    [authUserIds],
  );
  return new Map(rows.map((r) => [r.id, r.emailVerified]));
}

async function countAdvisedClasses(
  em: EntityManager,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await em
    .getRepository(AdministrativeClass)
    .createQueryBuilder('c')
    .select('c.advisorId', 'advisorId')
    .addSelect('COUNT(*)', 'total')
    .where('c.advisorId IN (:...userIds)', { userIds })
    .groupBy('c.advisorId')
    .getRawMany<{ advisorId: string; total: string }>();
  return new Map(rows.map((r) => [r.advisorId, Number(r.total)]));
}

/** Danh sách tài khoản có lọc + phân trang. Mặc định tài khoản chờ duyệt lên đầu. */
export async function listAccounts(
  filter: AccountFilter,
  list: ListParams<AccountSortKey> = firstPage(),
): Promise<AccountPageDto> {
  const { manager } = await getDataSource();
  const qb = manager.getRepository(User).createQueryBuilder('u');
  if (filter.role === 'STAFF') qb.where('u.role IN (:...roles)', { roles: STAFF_ROLES });
  else qb.where('u.role = :role', { role: filter.role });
  if (filter.status) qb.andWhere('u.accountStatus = :status', { status: filter.status });
  if (filter.q) {
    qb.andWhere('(u.userId ILIKE :q OR u.fullName ILIKE :q OR u.email ILIKE :q)', {
      q: `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`,
    });
  }
  if (list.sort) applyOrder(qb, ACCOUNT_SORT_COLUMNS[list.sort], list.dir, ['u.userId', 'ASC']);
  else {
    qb.orderBy(`CASE WHEN u.account_status = 'PENDING_APPROVAL' THEN 0 ELSE 1 END`, 'ASC');
    qb.addOrderBy('u.userId', 'ASC');
  }
  qb.skip(pageOffset(list)).take(list.size);

  const [users, total] = await qb.getManyAndCount();
  const [verified, classCounts] = await Promise.all([
    loadEmailVerified(
      manager,
      users.flatMap((u) => (u.authUserId ? [u.authUserId] : [])),
    ),
    countAdvisedClasses(
      manager,
      users.map((u) => u.userId),
    ),
  ]);

  return {
    items: users.map((u) => ({
      userId: u.userId,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      accountStatus: u.accountStatus,
      emailVerified: u.authUserId ? (verified.get(u.authUserId) ?? false) : null,
      advisedClassCount: classCounts.get(u.userId) ?? 0,
    })),
    total,
    page: list.page,
    size: list.size,
  };
}

async function lockStaffAccount(em: EntityManager, userId: string, actorId: string): Promise<User> {
  if (userId === actorId) {
    throw new AppError('SELF_CHANGE_FORBIDDEN', 'Không thể tự thay đổi tài khoản của chính mình.');
  }
  const user = await em.findOne(User, {
    where: { userId, role: In(STAFF_ROLES) },
    lock: { mode: 'pessimistic_write' },
  });
  if (!user) throw new AppError('ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản cán bộ.');
  return user;
}

async function assertNotAdvisingClasses(em: EntityManager, userId: string, message: string) {
  if (await em.existsBy(AdministrativeClass, { advisorId: userId })) {
    throw new AppError('ADVISOR_HAS_CLASSES', message);
  }
}

export async function changeAccountStatus(
  userId: string,
  action: AccountStatusAction,
  actorId: string,
): Promise<void> {
  const transition = STATUS_TRANSITIONS[action];
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const user = await lockStaffAccount(em, userId, actorId);
    if (user.accountStatus !== transition.from) {
      throw new AppError(
        'INVALID_STATUS',
        'Trạng thái tài khoản đã thay đổi, vui lòng tải lại trang.',
      );
    }
    if (action === 'SUSPEND') {
      await assertNotAdvisingClasses(
        em,
        userId,
        'Cố vấn học tập đang phụ trách lớp. Hãy chuyển lớp cho người khác trước khi khóa.',
      );
    }
    await em.update(User, { userId }, { accountStatus: transition.to });
    await writeAuditLog(
      {
        actorId,
        action: transition.audit,
        targetType: 'User',
        targetId: userId,
        detail: { from: transition.from, to: transition.to },
      },
      em,
    );
  });
}

/** Đổi vai trò giữa ADVISOR ↔ ADMIN (docs/rules/06: cấm tự đổi của mình, có Audit Log). */
export async function changeRole(userId: string, role: UserRole, actorId: string): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const user = await lockStaffAccount(em, userId, actorId);
    if (user.role === role) return;
    if (user.accountStatus !== UserAccountStatus.ACTIVE) {
      throw new AppError('INVALID_STATUS', 'Chỉ đổi vai trò cho tài khoản đang hoạt động.');
    }
    if (user.role === UserRole.ADVISOR) {
      await assertNotAdvisingClasses(
        em,
        userId,
        'Cố vấn học tập đang phụ trách lớp. Hãy chuyển lớp cho người khác trước khi đổi vai trò.',
      );
    }
    await em.update(User, { userId }, { role });
    await writeAuditLog(
      {
        actorId,
        action: 'ROLE_CHANGED',
        targetType: 'User',
        targetId: userId,
        detail: { from: user.role, to: role },
      },
      em,
    );
  });
}

/** Sửa mã cán bộ khi tài khoản còn chờ duyệt (docs/rules/09). */
export async function changeStaffCode(
  userId: string,
  newUserId: string,
  actorId: string,
): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const user = await lockStaffAccount(em, userId, actorId);
    if (user.accountStatus !== UserAccountStatus.PENDING_APPROVAL) {
      throw new AppError('INVALID_STATUS', 'Chỉ sửa mã cán bộ khi tài khoản đang chờ duyệt.');
    }
    if (newUserId === userId) return;
    if (await em.existsBy(User, { userId: newUserId })) {
      throw new AppError('STAFF_CODE_TAKEN', 'Mã cán bộ đã được dùng.');
    }
    await em.update(User, { userId }, { userId: newUserId });
    await writeAuditLog(
      {
        actorId,
        action: 'STAFF_CODE_CHANGED',
        targetType: 'User',
        targetId: newUserId,
        detail: { from: userId, to: newUserId },
      },
      em,
    );
  });
}
