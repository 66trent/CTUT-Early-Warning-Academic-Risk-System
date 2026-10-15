import { z } from 'zod';
import { isStaffEmail, staffEmailHint } from '@/lib/email-domains';

/**
 * Form đăng ký Cố vấn học tập (docs/rules/06). KHÔNG có trường vai trò — server luôn gán ADVISOR.
 * `staffEmailDomain` đọc từ biến môi trường STAFF_EMAIL_DOMAIN, truyền vào để dùng chung client/server.
 */
export function advisorRegistrationSchema(staffEmailDomain: string) {
  return z
    .object({
      staffCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9._-]{2,20}$/, 'Mã cán bộ gồm 2–20 ký tự chữ, số, dấu chấm, gạch ngang'),
      fullName: z.string().trim().min(2, 'Nhập họ tên').max(100, 'Họ tên tối đa 100 ký tự'),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.email('Email không hợp lệ'))
        .refine((v) => isStaffEmail(v, staffEmailDomain), staffEmailHint(staffEmailDomain))
        .refine((v) => v.length <= 100, 'Email tối đa 100 ký tự'),
      password: z
        .string()
        .min(8, 'Mật khẩu tối thiểu 8 ký tự')
        .max(128, 'Mật khẩu tối đa 128 ký tự'),
      confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Mật khẩu nhập lại không khớp',
    });
}

export type AdvisorRegistrationInput = z.input<ReturnType<typeof advisorRegistrationSchema>>;
export type AdvisorRegistration = z.output<ReturnType<typeof advisorRegistrationSchema>>;
