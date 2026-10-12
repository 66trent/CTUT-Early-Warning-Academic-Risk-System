import { getDataSource } from '@/db/data-source';
import { Student } from '@/db/entities/student.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { ForbiddenError } from './errors';

/** Người dùng đã đăng nhập, đọc từ entity `User` ở server (không tin dữ liệu client gửi). */
export interface SessionUser {
  /** User.userId — mã sinh viên hoặc mã cán bộ. */
  userId: string;
  authUserId: string;
  role: UserRole;
  fullName: string;
  email: string;
  accountStatus: UserAccountStatus;
}

export type ScopedResource = 'Student' | 'Alert' | 'Intervention' | 'RiskScore' | 'SourceRecord';
/** READ: xem · PROCESS: xử lý cảnh báo / ghi can thiệp. */
export type ScopeAction = 'READ' | 'PROCESS';

export interface ScopeContext {
  studentId: string;
  resourceType: ScopedResource;
  action?: ScopeAction;
}

/**
 * Quyết định thuần (không truy vấn DB) theo ma trận phạm vi docs/rules/00, 06.
 * `classAdvisorId` = AdministrativeClass.advisorId của lớp sinh viên; `undefined` = không tìm thấy SV.
 */
export function isWithinScope(
  user: SessionUser,
  context: ScopeContext,
  classAdvisorId: string | null | undefined,
): boolean {
  if (user.accountStatus !== UserAccountStatus.ACTIVE) return false;
  const action = context.action ?? 'READ';

  switch (user.role) {
    case UserRole.STUDENT:
      return action === 'READ' && context.studentId === user.userId;
    case UserRole.ADVISOR:
      return classAdvisorId !== undefined && classAdvisorId === user.userId;
    case UserRole.ADMIN:
      // Admin chỉ giám sát: đọc mọi dữ liệu, KHÔNG xử lý cảnh báo / ghi can thiệp.
      return action === 'READ';
    default:
      return false;
  }
}

/** CVHT của lớp sinh hoạt hiện tại của sinh viên — suy ra qua Student.classId (không lưu lặp). */
async function findClassAdvisorId(studentId: string): Promise<string | null | undefined> {
  const dataSource = await getDataSource();
  const row = await dataSource
    .getRepository(Student)
    .createQueryBuilder('s')
    .innerJoin('s.administrativeClass', 'c')
    .select('c.advisorId', 'advisorId')
    .where('s.studentId = :studentId', { studentId })
    .getRawOne<{ advisorId: string | null }>();
  return row ? row.advisorId : undefined;
}

/**
 * Bắt buộc gọi trước MỌI truy vấn đọc/ghi dữ liệu sinh viên trong Server Action / Route Handler.
 * Vi phạm → ForbiddenError (cùng thông báo cho "không có quyền" và "không tồn tại", chống dò ID).
 */
export async function assertScope(user: SessionUser, context: ScopeContext): Promise<void> {
  const needsLookup = user.role === UserRole.ADVISOR;
  const classAdvisorId = needsLookup ? await findClassAdvisorId(context.studentId) : null;
  if (!isWithinScope(user, context, classAdvisorId)) throw new ForbiddenError();
}
