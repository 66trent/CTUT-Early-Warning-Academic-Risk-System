import { z } from 'zod';
import { UserAccountStatus, UserRole } from '@/db/enums';

export const ACCOUNT_STATUS_ACTIONS = ['APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE'] as const;
export type AccountStatusAction = (typeof ACCOUNT_STATUS_ACTIONS)[number];

export const changeAccountStatusSchema = z.object({
  userId: z.string().trim().min(1).max(20),
  action: z.enum(ACCOUNT_STATUS_ACTIONS),
});

/** Chỉ đổi giữa 2 vai trò cán bộ; vai trò sinh viên đến từ danh sách sinh viên, không đổi tay. */
export const changeRoleSchema = z.object({
  userId: z.string().trim().min(1).max(20),
  role: z.enum([UserRole.ADVISOR, UserRole.ADMIN]),
});

export const changeStaffCodeSchema = z.object({
  userId: z.string().trim().min(1).max(20),
  newUserId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._-]{2,20}$/, 'Mã cán bộ gồm 2–20 ký tự chữ, số, dấu chấm, gạch ngang'),
});

export const ACCOUNT_ROLE_FILTERS = [
  'STAFF',
  UserRole.ADVISOR,
  UserRole.ADMIN,
  UserRole.STUDENT,
] as const;
export type AccountRoleFilter = (typeof ACCOUNT_ROLE_FILTERS)[number];

/** Bộ lọc danh sách tài khoản — đọc từ query string. */
export const accountFilterSchema = z.object({
  role: z.enum(ACCOUNT_ROLE_FILTERS).catch('STAFF'),
  status: z.enum(UserAccountStatus).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  /** Chỉ Cố vấn học tập chưa được gán lớp nào. */
  noClass: z
    .literal('1')
    .optional()
    .catch(undefined)
    .transform((v) => v === '1'),
});
export type AccountFilter = z.output<typeof accountFilterSchema>;
