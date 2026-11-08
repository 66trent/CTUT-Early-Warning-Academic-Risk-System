/**
 * Tài khoản hệ thống (Phase 10c — người dùng chốt 2026-11-08, docs/tich-hop-moodle.md 9c): người
 * thực hiện lô nạp / lần đồng bộ / Audit Log do chế độ Tự động của Moodle tạo. Không đăng nhập được:
 * `SUSPENDED`, không có tài khoản Better Auth, email đuôi `.invalid` (tên miền dành riêng, không bao giờ
 * khớp `STAFF_EMAIL_DOMAIN`). Không đặt trong file service có `getDataSource` (bẫy #28).
 */
export const MOODLE_SYSTEM_USER_ID = 'SYSTEM_MOODLE';
export const MOODLE_SYSTEM_USER_NAME = 'Đồng bộ Moodle (hệ thống)';
export const MOODLE_SYSTEM_USER_EMAIL = 'dong-bo-moodle@he-thong.invalid';

export function isSystemAccount(userId: string | null | undefined): boolean {
  return userId === MOODLE_SYSTEM_USER_ID;
}
