import { AlertStatus, ConfidentialityLevel, InterventionType } from '@/db/enums';

/** Lời văn cho người dùng (docs/rules/07) — dùng được ở client. */
export const INTERVENTION_TYPE_LABELS: Record<InterventionType, string> = {
  [InterventionType.EMAIL]: 'Gửi email',
  [InterventionType.PHONE_CALL]: 'Gọi điện',
  [InterventionType.IN_PERSON_MEETING]: 'Gặp trực tiếp',
  [InterventionType.OTHER]: 'Khác',
};

export const INTERVENTION_STATUS_LABELS: Record<string, string> = {
  DONE: 'Đã thực hiện',
  FOLLOW_UP: 'Cần theo dõi tiếp',
};

export const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = {
  [ConfidentialityLevel.NORMAL]: 'Thông thường',
  [ConfidentialityLevel.SENSITIVE]: 'Bảo mật (chỉ Cố vấn học tập phụ trách xem được)',
};

/** Nút chuyển trạng thái — nhãn hành động. */
export const TRANSITION_LABELS: Partial<Record<AlertStatus, string>> = {
  [AlertStatus.ACKNOWLEDGED]: 'Xác nhận đã xem',
  [AlertStatus.IN_PROGRESS]: 'Bắt đầu xử lý',
  [AlertStatus.RESOLVED]: 'Đánh dấu đã giải quyết',
  [AlertStatus.DISMISSED]: 'Bỏ qua (báo sai)',
  [AlertStatus.INVALIDATED]: 'Không còn hiệu lực',
};

export const NEEDS_REASON: readonly AlertStatus[] = [
  AlertStatus.DISMISSED,
  AlertStatus.INVALIDATED,
];
