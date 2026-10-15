/**
 * Quy tắc đuôi email (docs/rules/06, 09). Không import code server — dùng được ở client.
 */

/** Đuôi email bắt buộc của sinh viên. */
export const STUDENT_EMAIL_DOMAIN = '@student.ctuet.edu.vn';

/**
 * `STAFF_EMAIL_DOMAIN=*` — nhận mọi email (trừ email sinh viên) cho cán bộ.
 * Chỉ dùng khi phát triển/thử nghiệm chưa có email trường; triển khai thật đặt lại đuôi trường.
 */
export const ANY_STAFF_DOMAIN = '*';

/** Đuôi email cán bộ của trường — dùng cho tài khoản demo (docs/demo-data) khi cấu hình là `*`. */
export const SCHOOL_STAFF_DOMAIN = '@ctuet.edu.vn';

export function isStudentEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(STUDENT_EMAIL_DOMAIN);
}

/** Email cán bộ hợp lệ theo cấu hình. Email sinh viên KHÔNG BAO GIỜ được coi là email cán bộ. */
export function isStaffEmail(email: string, staffEmailDomain: string): boolean {
  if (isStudentEmail(email)) return false;
  if (staffEmailDomain === ANY_STAFF_DOMAIN) return true;
  return email.trim().toLowerCase().endsWith(staffEmailDomain.toLowerCase());
}

/** Đuôi dùng để ghép email tài khoản mẫu (demo, test). */
export function staffDomainForSamples(staffEmailDomain: string): string {
  return staffEmailDomain === ANY_STAFF_DOMAIN ? SCHOOL_STAFF_DOMAIN : staffEmailDomain;
}

/** Lời hướng dẫn trên form đăng ký. */
export function staffEmailHint(staffEmailDomain: string): string {
  return staffEmailDomain === ANY_STAFF_DOMAIN
    ? 'Dùng email cá nhân của bạn (không dùng email sinh viên).'
    : `Dùng email cán bộ có đuôi ${staffEmailDomain}.`;
}
