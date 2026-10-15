/**
 * Lời báo lỗi đăng nhập hiển thị cho người dùng (docs/rules/07: không hiện mã kỹ thuật).
 * Dùng được ở client — không import code server.
 */
const MESSAGES: Record<string, string> = {
  INVALID_DOMAIN:
    'Chỉ chấp nhận email của trường: sinh viên dùng @student.ctuet.edu.vn, cán bộ dùng email cán bộ.',
  NO_STUDENT_PROFILE: 'Chưa có hồ sơ sinh viên của bạn. Vui lòng liên hệ phòng Đào tạo.',
  STAFF_ACCOUNT_NOT_FOUND:
    'Email cán bộ này chưa có tài khoản. Cố vấn học tập vui lòng đăng ký và chờ Quản trị viên duyệt.',
  ACCOUNT_INACTIVE:
    'Tài khoản chưa được kích hoạt hoặc đang tạm khóa. Vui lòng liên hệ Quản trị viên.',
  EMAIL_NOT_VERIFIED:
    'Email chưa được xác minh. Vui lòng mở liên kết xác minh trong hộp thư của bạn.',
  INVALID_EMAIL_OR_PASSWORD: 'Email hoặc mật khẩu chưa đúng.',
  RATE_LIMITED: 'Bạn đã thử quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại.',
  DEMO_DISABLED: 'Chế độ demo đang tắt.',
  DEMO_ACCOUNT_MISSING: 'Tài khoản demo chưa được tạo. Quản trị viên cần chạy dữ liệu demo.',
};

const FALLBACK = 'Đăng nhập không thành công. Vui lòng thử lại.';

export function signInMessage(code: string | null | undefined): string {
  if (!code) return FALLBACK;
  return MESSAGES[code.toUpperCase()] ?? FALLBACK;
}
