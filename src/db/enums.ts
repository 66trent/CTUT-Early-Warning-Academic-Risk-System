/**
 * Nguồn DUY NHẤT cho mọi enum dùng chung (docs/rules/00, 01, 09–12).
 *
 * - Enum ỔN ĐỊNH: `enum` TypeScript → cột `type: 'enum'` trong PostgreSQL.
 * - Danh sách HAY MỞ RỘNG (ImportDataType, ImportErrorReason, AuditAction): mảng `as const`
 *   + union type, lưu `varchar` và kiểm tra bằng Zod — tránh `ALTER TYPE ... ADD VALUE`.
 */

// ── Danh tính (09) ────────────────────────────────────────────────
export enum UserRole {
  STUDENT = 'STUDENT',
  ADVISOR = 'ADVISOR',
  ADMIN = 'ADMIN',
}

export enum UserAccountStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum OfficialAcademicStatus {
  ACTIVE = 'ACTIVE',
  RESERVED = 'RESERVED',
  SUSPENDED = 'SUSPENDED',
  GRADUATED = 'GRADUATED',
  DISMISSED = 'DISMISSED',
}

export enum EnrollmentStatus {
  REGISTERED = 'REGISTERED',
  WITHDRAWN = 'WITHDRAWN',
  COMPLETED = 'COMPLETED',
}

export enum AttemptOutcome {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

// ── Dữ liệu nguồn (10) ────────────────────────────────────────────
export enum QuizAttemptStatus {
  SUBMITTED = 'SUBMITTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ABANDONED = 'ABANDONED',
}

/** Loại bài trên LMS (docs/rules/10): trắc nghiệm / bài thực hành nộp file. */
export enum LmsActivityType {
  QUIZ = 'QUIZ',
  ASSIGNMENT = 'ASSIGNMENT',
}

/** Trạng thái nộp 1 bài thực hành theo file (docs/rules/10). */
export enum SubmissionStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
  NOT_SUBMITTED = 'NOT_SUBMITTED',
}

// ── Trạng thái dữ liệu 2 tầng (00) ────────────────────────────────
/** Tầng 1 — trạng thái của TỪNG nhóm chỉ số đầu vào. */
export enum DataStatus {
  AVAILABLE = 'AVAILABLE',
  MISSING = 'MISSING',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  STALE = 'STALE',
  INVALID = 'INVALID',
}

/** Tầng 2 — mức tổng hợp của RiskScore 1 sinh viên. */
export enum DataCompletenessLevel {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
  INSUFFICIENT = 'INSUFFICIENT',
}

// ── Rule engine & cảnh báo (11) ──────────────────────────────────
export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Thứ tự tăng dần — dùng để lấy max(), không so sánh chuỗi. */
export const SEVERITY_ORDER: readonly Severity[] = [
  Severity.LOW,
  Severity.MEDIUM,
  Severity.HIGH,
  Severity.CRITICAL,
];

export enum RuleGroup {
  ATTENDANCE = 'ATTENDANCE',
  ACADEMIC = 'ACADEMIC',
  LMS = 'LMS',
  COMBINED = 'COMBINED',
  EXCEPTION = 'EXCEPTION',
  /** Chỉ `Rule` cấu hình chung `RISK-SCORE` (trọng số + tham số dữ liệu) — không phải luật cảnh báo. */
  RISK_SCORE = 'RISK_SCORE',
}

/** Phạm vi luật (docs/rules/08) — lưu varchar(30). */
export const RULE_SCOPES = ['PER_COURSE', 'PER_STUDENT'] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export enum RuleStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
  INVALIDATED = 'INVALIDATED',
  REOPENED = 'REOPENED',
}

export enum InterventionType {
  EMAIL = 'EMAIL',
  PHONE_CALL = 'PHONE_CALL',
  IN_PERSON_MEETING = 'IN_PERSON_MEETING',
  OTHER = 'OTHER',
}

export enum ConfidentialityLevel {
  NORMAL = 'NORMAL',
  SENSITIVE = 'SENSITIVE',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum EvaluationTrigger {
  AUTO_AFTER_IMPORT = 'AUTO_AFTER_IMPORT',
  MANUAL = 'MANUAL',
  /** Lịch chạy mỗi đêm cho học kỳ hiện tại (docs/rules/05). */
  SCHEDULED = 'SCHEDULED',
  /** Lần chạy cuối khi chốt học kỳ — xong thì đặt `Term.closedAt` (docs/rules/08). */
  TERM_CLOSING = 'TERM_CLOSING',
}

export enum EvaluationRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ── Nhập dữ liệu (12) ─────────────────────────────────────────────
/** Tên `ImportSource` (không phải `DataSource`) để tránh trùng class của TypeORM. */
export enum ImportSource {
  FILE = 'FILE',
}

export enum ImportBatchStatus {
  UPLOADING = 'UPLOADING',
  VALIDATING = 'VALIDATING',
  STAGED = 'STAGED',
  LOADED = 'LOADED',
  RECONCILED = 'RECONCILED',
  REJECTED = 'REJECTED',
  DISCARDED = 'DISCARDED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export const IMPORT_DATA_TYPES = [
  'STUDENT',
  'ATTENDANCE_SUMMARY',
  'LMS_QUIZ',
  'LMS_ASSIGNMENT',
  'COURSE_RESULT',
] as const;
export type ImportDataType = (typeof IMPORT_DATA_TYPES)[number];

export const IMPORT_ERROR_REASONS = [
  'INVALID_FORMAT',
  'STUDENT_NOT_FOUND',
  'CLASS_NOT_FOUND',
  'DUPLICATE',
  'OUT_OF_RANGE',
  'TERM_MISMATCH',
  'COURSE_MISMATCH',
] as const;
export type ImportErrorReason = (typeof IMPORT_ERROR_REASONS)[number];

// ── Cảnh báo (11) — danh sách hay mở rộng: varchar + union/Zod ──────
/** `Intervention.status`: đã thực hiện / cần theo dõi tiếp (có `nextFollowUpAt`). */
export const INTERVENTION_STATUSES = ['DONE', 'FOLLOW_UP'] as const;
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

/** Sự kiện làm phát sinh thông báo (docs/rules/06). */
export const NOTIFICATION_EVENTS = ['CREATED', 'REOPENED', 'SEVERITY_INCREASED'] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** Cảnh báo chưa đóng — Cố vấn học tập còn phải xử lý. */
export const OPEN_ALERT_STATUSES: readonly AlertStatus[] = [
  AlertStatus.OPEN,
  AlertStatus.ACKNOWLEDGED,
  AlertStatus.IN_PROGRESS,
  AlertStatus.REOPENED,
];
