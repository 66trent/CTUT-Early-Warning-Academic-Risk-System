import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { STUDENT_EMAIL_DOMAIN } from '@/lib/email-domains';
import { UserAccountStatus, UserRole } from '../enums';

export { STUDENT_EMAIL_DOMAIN };

/**
 * Tài khoản nghiệp vụ (schema public) — docs/rules/09.
 * Liên kết tài khoản Better Auth (schema auth) qua `authUserId`; KHÔNG thêm cột vào bảng auth.*.
 */
@Entity('users')
@Check(
  'CHK_users_student_email_domain',
  `"role" <> 'STUDENT' OR "email" LIKE '%${STUDENT_EMAIL_DOMAIN}'`,
)
@Check('CHK_users_email_lowercase', `"email" = lower("email")`)
export class User {
  /** STUDENT: mã sinh viên. ADVISOR/ADMIN: mã cán bộ. */
  @PrimaryColumn({ type: 'varchar', length: 20 })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  fullName!: string;

  @Index()
  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role!: UserRole;

  /** Luôn lưu chữ thường. */
  @Column({ type: 'varchar', length: 100, unique: true })
  email!: string;

  @Column({ type: 'enum', enum: UserAccountStatus, enumName: 'user_account_status' })
  accountStatus!: UserAccountStatus;

  /** Id tài khoản Better Auth — gán ở lần đăng nhập/đăng ký đầu tiên bằng cách khớp email. */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  authUserId!: string | null;
}
