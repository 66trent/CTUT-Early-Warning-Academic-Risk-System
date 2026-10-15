import {
  AlertStatus,
  DataCompletenessLevel,
  OfficialAcademicStatus,
  Severity,
  UserAccountStatus,
  UserRole,
} from '@/db/enums';

/** Nhãn tiếng Việt hiển thị cho người dùng — 1 nơi duy nhất, nhất quán toàn app (docs/rules/07). */

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.STUDENT]: 'Sinh viên',
  [UserRole.ADVISOR]: 'Cố vấn học tập',
  [UserRole.ADMIN]: 'Quản trị viên',
};

export const ACCOUNT_STATUS_LABELS: Record<UserAccountStatus, string> = {
  [UserAccountStatus.PENDING_APPROVAL]: 'Chờ duyệt',
  [UserAccountStatus.ACTIVE]: 'Đang hoạt động',
  [UserAccountStatus.REJECTED]: 'Đã từ chối',
  [UserAccountStatus.SUSPENDED]: 'Tạm khóa',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  [Severity.LOW]: 'Thấp',
  [Severity.MEDIUM]: 'Trung bình',
  [Severity.HIGH]: 'Cao',
  [Severity.CRITICAL]: 'Rất cao',
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  [AlertStatus.OPEN]: 'Mới',
  [AlertStatus.ACKNOWLEDGED]: 'Đã xác nhận',
  [AlertStatus.IN_PROGRESS]: 'Đang xử lý',
  [AlertStatus.RESOLVED]: 'Đã giải quyết',
  [AlertStatus.DISMISSED]: 'Đã bỏ qua',
  [AlertStatus.INVALIDATED]: 'Không còn hiệu lực',
  [AlertStatus.REOPENED]: 'Mở lại',
};

export const DATA_COMPLETENESS_LABELS: Record<DataCompletenessLevel, string> = {
  [DataCompletenessLevel.FULL]: 'Đủ dữ liệu',
  [DataCompletenessLevel.PARTIAL]: 'Thiếu một phần dữ liệu',
  [DataCompletenessLevel.INSUFFICIENT]: 'Chưa đủ dữ liệu',
};

/** Tình trạng học vụ chính thức — bản sao chỉ đọc từ phòng đào tạo (docs/rules/00). */
export const OFFICIAL_STATUS_LABELS: Record<OfficialAcademicStatus, string> = {
  [OfficialAcademicStatus.ACTIVE]: 'Đang học',
  [OfficialAcademicStatus.RESERVED]: 'Bảo lưu',
  [OfficialAcademicStatus.SUSPENDED]: 'Đình chỉ',
  [OfficialAcademicStatus.GRADUATED]: 'Tốt nghiệp',
  [OfficialAcademicStatus.DISMISSED]: 'Buộc thôi học',
};

export const REFERENCE_ONLY_NOTICE =
  'Cảnh báo sớm — mang tính tham khảo, không phải quyết định học vụ chính thức';
