import type { AuditAction } from './audit';
import { formatVnDateTime } from './dates';
import { ACCOUNT_STATUS_LABELS, ALERT_STATUS_LABELS, ROLE_LABELS } from './labels';

/** Nhãn tiếng Việt cho hành động trong Audit Log — đủ mọi giá trị (kiểm bằng kiểu). Dùng được ở client. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN_FAILED: 'Đăng nhập thất bại',
  SIGN_IN_REJECTED: 'Từ chối đăng nhập Google',
  ADVISOR_REGISTERED: 'Cố vấn học tập đăng ký',
  DEMO_QUICK_LOGIN: 'Đăng nhập nhanh (trình diễn)',
  ACCOUNT_APPROVED: 'Duyệt tài khoản',
  ACCOUNT_REJECTED: 'Từ chối tài khoản',
  ACCOUNT_SUSPENDED: 'Khóa tài khoản',
  ACCOUNT_REACTIVATED: 'Mở khóa tài khoản',
  STAFF_CODE_CHANGED: 'Đổi mã cán bộ',
  ROLE_CHANGED: 'Đổi vai trò',
  TERM_CREATED: 'Tạo học kỳ',
  TERM_SET_CURRENT: 'Đặt học kỳ hiện tại',
  TERM_CLOSED: 'Chốt học kỳ',
  TERM_CLOSE_REQUESTED: 'Yêu cầu chốt học kỳ (chạy đánh giá cuối)',
  CLASS_CREATED: 'Tạo lớp sinh hoạt',
  CLASS_UPDATED: 'Sửa lớp sinh hoạt',
  CLASS_ADVISOR_CHANGED: 'Đổi Cố vấn học tập của lớp',
  IMPORT_CREATED: 'Tải file nhập dữ liệu',
  IMPORT_CONFIRMED: 'Xác nhận nhập dữ liệu',
  IMPORT_LOADED: 'Nhập dữ liệu xong',
  IMPORT_REJECTED: 'Đợt nhập bị từ chối',
  IMPORT_DISCARDED: 'Hủy đợt nhập',
  IMPORT_EXPIRED: 'Đợt nhập tự hủy (quá hạn)',
  IMPORT_ROLLED_BACK: 'Hoàn tác đợt nhập',
  RULE_VERSION_CREATED: 'Tạo bản nháp luật',
  RULE_DRY_RUN: 'Chạy thử luật',
  RULE_ACTIVATED: 'Kích hoạt phiên bản luật',
  RULE_VERSION_DISCARDED: 'Bỏ bản nháp luật',
  EVALUATION_RUN_REQUESTED: 'Chạy đánh giá',
  ENROLLMENT_WITHDRAWN: 'Đánh dấu rút học phần',
  ENROLLMENT_WITHDRAWAL_UNDONE: 'Bỏ đánh dấu rút học phần',
  ALERT_STATUS_CHANGED: 'Đổi trạng thái cảnh báo',
  ALERTS_REASSIGNED: 'Chuyển cảnh báo sang Cố vấn học tập khác',
  INTERVENTION_RECORDED: 'Ghi can thiệp',
  STUDENT_PROFILE_VIEWED: 'Xem hồ sơ sinh viên',
  ALERT_EXPORT: 'Xuất danh sách cảnh báo',
  MOODLE_LINK_UPDATED: 'Đổi liên kết khóa học Moodle',
  MOODLE_SYNC_REQUESTED: 'Đồng bộ Moodle',
  MOODLE_SYNC_CONFIRMED: 'Xác nhận nhập dữ liệu Moodle',
  MOODLE_SYNC_DISCARDED: 'Hủy lần đồng bộ Moodle',
  MOODLE_SYNC_AUTO: 'Đồng bộ Moodle tự động',
};

/** Tên đối tượng bằng tiếng Việt thay cho tên bảng (docs/rules/07). */
export const AUDIT_TARGET_LABELS: Record<string, string> = {
  AdministrativeClass: 'Lớp sinh hoạt',
  Alert: 'Cảnh báo',
  AuthAccount: 'Tài khoản đăng nhập',
  Enrollment: 'Đăng ký học phần',
  EvaluationRun: 'Lần chạy đánh giá',
  ImportBatch: 'Đợt nhập',
  MoodleCourseLink: 'Khóa học Moodle',
  MoodleSyncRun: 'Lần đồng bộ Moodle',
  RuleVersion: 'Phiên bản luật',
  Student: 'Sinh viên',
  Term: 'Học kỳ',
  User: 'Tài khoản',
};

const DETAIL_LABELS: Record<string, string> = {
  advisorId: 'Cố vấn học tập',
  alerts: 'Số cảnh báo',
  asOf: 'Tính đến',
  courseId: 'Học phần',
  courses: 'Số khóa học',
  departmentId: 'Khoa',
  endDate: 'Đến ngày',
  format: 'Định dạng',
  from: 'Từ',
  majorId: 'Ngành',
  mode: 'Chế độ',
  previousTermId: 'Học kỳ trước',
  reason: 'Lý do',
  rows: 'Số dòng',
  ruleCode: 'Luật',
  sectionCode: 'Lớp học phần',
  startDate: 'Từ ngày',
  studentId: 'Sinh viên',
  students: 'Số sinh viên',
  termId: 'Học kỳ',
  to: 'Sang',
  toAdvisorId: 'Cố vấn mới',
  version: 'Phiên bản',
};

const VALUE_LABELS: Record<string, string> = {
  ...ACCOUNT_STATUS_LABELS,
  ...ROLE_LABELS,
  ...ALERT_STATUS_LABELS,
  AUTO: 'Tự động',
  MANUAL: 'Thủ công',
  false: 'Không',
  true: 'Có',
};

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const TECHNICAL_VALUE = /^[{[]|^[A-Z][A-Z_]+$/;

export interface AuditDetailView {
  rows: { label: string; value: string }[];
  /** Mã lỗi, JSON… — chỉ mở khi cần tra cứu. */
  technical: { key: string; value: string }[];
}

/** Tách chi tiết nhật ký thành phần đọc được và phần kỹ thuật (docs/rules/07). */
export function presentAuditDetail(detail: { key: string; value: string }[]): AuditDetailView {
  const view: AuditDetailView = { rows: [], technical: [] };
  for (const { key, value } of detail) {
    if (value === 'null') continue;
    const label = DETAIL_LABELS[key];
    const translated = VALUE_LABELS[value];
    if (label && translated) view.rows.push({ label, value: translated });
    else if (label && ISO_DATETIME.test(value))
      view.rows.push({ label, value: formatVnDateTime(value) });
    else if (label && !TECHNICAL_VALUE.test(value)) view.rows.push({ label, value });
    else view.technical.push({ key, value });
  }
  return view;
}
