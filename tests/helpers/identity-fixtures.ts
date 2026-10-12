import { type DataSource } from 'typeorm';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Department } from '@/db/entities/department.entity';
import { Student } from '@/db/entities/student.entity';
import { User } from '@/db/entities/user.entity';
import { OfficialAcademicStatus, UserAccountStatus, UserRole } from '@/db/enums';
import { staffDomainForSamples } from '@/lib/email-domains';

/**
 * Dữ liệu mẫu cho test tích hợp — mọi mã bắt đầu bằng `TST` để dọn sạch sau khi chạy.
 * 2 CVHT (A, B) phụ trách 2 lớp; mỗi lớp 1 sinh viên; 1 CVHT đang chờ duyệt.
 */
export const FX = {
  departmentId: 'K.CNTT',
  advisorA: 'TSTGV_A',
  advisorB: 'TSTGV_B',
  advisorPending: 'TSTGV_P',
  classA: 'TSTCLS_A',
  classB: 'TSTCLS_B',
  studentA: 'TSTSV_A',
  studentB: 'TSTSV_B',
  studentAEmail: 'tstsv_a@student.ctuet.edu.vn',
} as const;

export function staffEmail(userId: string, staffDomain: string): string {
  return `${userId.toLowerCase()}${staffDomainForSamples(staffDomain)}`;
}

export async function createIdentityFixtures(ds: DataSource, staffDomain: string): Promise<void> {
  await cleanupIdentityFixtures(ds);
  await ds
    .getRepository(Department)
    .upsert({ departmentId: FX.departmentId, departmentName: 'Khoa Công nghệ thông tin' }, [
      'departmentId',
    ]);

  const staff = (userId: string, accountStatus: UserAccountStatus) => ({
    userId,
    fullName: `CVHT ${userId}`,
    email: staffEmail(userId, staffDomain),
    role: UserRole.ADVISOR,
    accountStatus,
    authUserId: null,
  });
  const student = (userId: string, email: string) => ({
    userId,
    fullName: `Sinh viên ${userId}`,
    email,
    role: UserRole.STUDENT,
    accountStatus: UserAccountStatus.ACTIVE,
    authUserId: null,
  });

  await ds
    .getRepository(User)
    .insert([
      staff(FX.advisorA, UserAccountStatus.ACTIVE),
      staff(FX.advisorB, UserAccountStatus.ACTIVE),
      staff(FX.advisorPending, UserAccountStatus.PENDING_APPROVAL),
      student(FX.studentA, FX.studentAEmail),
      student(FX.studentB, 'tstsv_b@student.ctuet.edu.vn'),
    ]);
  await ds.getRepository(AdministrativeClass).insert([
    {
      classId: FX.classA,
      className: 'Lớp thử A',
      departmentId: FX.departmentId,
      cohortYear: '2023',
      advisorId: FX.advisorA,
    },
    {
      classId: FX.classB,
      className: 'Lớp thử B',
      departmentId: FX.departmentId,
      cohortYear: '2023',
      advisorId: FX.advisorB,
    },
  ]);
  await ds.getRepository(Student).insert([
    {
      studentId: FX.studentA,
      fullName: 'Sinh viên A',
      classId: FX.classA,
      officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
    },
    {
      studentId: FX.studentB,
      fullName: 'Sinh viên B',
      classId: FX.classB,
      officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
    },
  ]);
}

/** Xóa dữ liệu test (cả tài khoản Better Auth). Chỉ dùng trong test. */
export async function cleanupIdentityFixtures(ds: DataSource): Promise<void> {
  await ds.query(`DELETE FROM students WHERE student_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM administrative_classes WHERE class_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM users WHERE user_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM audit_logs WHERE actor_id LIKE 'TST%' OR target_id LIKE 'TST%'`);
  await ds.query(`DELETE FROM auth."user" WHERE email LIKE 'tst%'`);
}

export async function countByEmail(ds: DataSource, email: string) {
  const [authRow] = await ds.query<{ n: string }[]>(
    `SELECT count(*) AS n FROM auth."user" WHERE email = $1`,
    [email],
  );
  const [userRow] = await ds.query<{ n: string }[]>(
    `SELECT count(*) AS n FROM users WHERE email = $1`,
    [email],
  );
  return { authUsers: Number(authRow?.n), users: Number(userRow?.n) };
}
