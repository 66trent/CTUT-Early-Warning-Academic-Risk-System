import { EvaluationRunStatus, EvaluationTrigger, RuleGroup, RuleStatus } from '@/db/enums';

/** Lời văn cho người dùng — không hiện mã kỹ thuật trên giao diện (docs/rules/07). Dùng được ở client. */
export const RUN_STATUS_LABELS: Record<EvaluationRunStatus, string> = {
  [EvaluationRunStatus.QUEUED]: 'Đang chờ',
  [EvaluationRunStatus.RUNNING]: 'Đang chạy',
  [EvaluationRunStatus.COMPLETED]: 'Hoàn tất',
  [EvaluationRunStatus.FAILED]: 'Lỗi',
};

export const RUN_TRIGGER_LABELS: Record<EvaluationTrigger, string> = {
  [EvaluationTrigger.AUTO_AFTER_IMPORT]: 'Tự động sau khi nạp',
  [EvaluationTrigger.MANUAL]: 'Admin chạy',
  [EvaluationTrigger.SCHEDULED]: 'Tự động theo lịch',
};

export const RULE_GROUP_LABELS: Record<RuleGroup, string> = {
  [RuleGroup.ATTENDANCE]: 'Điểm danh',
  [RuleGroup.LMS]: 'Bài kiểm tra LMS',
  [RuleGroup.ACADEMIC]: 'Học lực',
  [RuleGroup.COMBINED]: 'Kết hợp',
  [RuleGroup.EXCEPTION]: 'Ngoại lệ',
  [RuleGroup.RISK_SCORE]: 'Điểm rủi ro',
};

export const RULE_STATUS_LABELS: Record<RuleStatus, string> = {
  [RuleStatus.DRAFT]: 'Bản nháp',
  [RuleStatus.ACTIVE]: 'Đang áp dụng',
  [RuleStatus.INACTIVE]: 'Đã thay thế',
  [RuleStatus.ARCHIVED]: 'Đã bỏ',
};

/** Mô tả ngắn từng luật (docs/rules/08) — giúp người cấu hình hiểu ngưỡng đang sửa. */
export const RULE_DESCRIPTIONS: Record<string, string> = {
  'ATT-01':
    'Tỷ lệ buổi vắng trên tổng buổi của học phần. Quy chế: vắng vượt quá 20% bị cấm thi — hệ thống chỉ cảnh báo, không ghi điểm.',
  'ATT-02': 'Số buổi vắng không phép tăng nhanh giữa 2 lần chốt điểm danh gần nhau.',
  'ATT-03': 'Số lần đi trễ nhiều. Mức thấp chỉ hiện trong ứng dụng, không gửi email.',
  'LMS-01': 'Số bài kiểm tra đã đến hạn mà sinh viên chưa nộp.',
  'LMS-02': 'Điểm các bài kiểm tra gần nhất đã nộp đều thấp hơn ngưỡng.',
  'ACA-01': 'Điểm quá trình (trước kỳ thi) thấp hơn ngưỡng.',
  'ACA-02': 'Số học phần không đạt trong học kỳ (sau khi có điểm cuối kỳ).',
  'ACA-03': 'Điểm trung bình học kỳ hệ 4 thấp hơn ngưỡng (sau khi có điểm cuối kỳ).',
  'COMB-01': 'Nhiều nguồn dữ liệu (điểm danh, LMS, học lực) cùng có dấu hiệu trên 1 học phần.',
  'COMB-02': 'Đang học lại học phần đã rớt mà vẫn có dấu hiệu điểm danh hoặc LMS.',
  'RISK-SCORE':
    'Trọng số điểm rủi ro tổng hợp và tham số dữ liệu dùng chung cho nhiều luật (độ mới điểm danh, bài LMS đến hạn).',
};

/** Nhãn trường trong `condition`. Khóa dạng `MÃ_LUẬT:trường` ghi đè nhãn chung khi nghĩa khác. */
export const CONDITION_FIELD_LABELS: Record<string, string> = {
  denominator: 'Mẫu số tính tỷ lệ vắng',
  countExcused: 'Tính cả vắng có phép',
  lateToAbsenceRatio: 'Số lần trễ quy đổi 1 buổi vắng (0 = không quy đổi)',
  minSessions: 'Chỉ xét khi đã học từ (buổi)',
  bands: 'Các mức cảnh báo',
  percent: 'Tỷ lệ vắng (%)',
  op: 'So sánh',
  severity: 'Mức cảnh báo',
  windowDays: 'Hai lần chốt cách nhau tối đa (ngày)',
  minIncrease: 'Số buổi vắng không phép tăng thêm từ',
  minLate: 'Số lần đi trễ từ',
  minMissed: 'Số bài chưa nộp từ',
  recentCount: 'Số bài gần nhất cần xét',
  thresholdPercent: 'Điểm dưới (% thang điểm của bài)',
  threshold: 'Ngưỡng',
  'ACA-01:threshold': 'Điểm quá trình dưới (thang 10)',
  'ACA-03:threshold': 'Điểm trung bình hệ 4 dưới',
  minFailed: 'Số học phần không đạt từ',
  minCredits: 'Chỉ xét khi tổng tín chỉ có điểm từ',
  gradeScale: 'Quy đổi điểm chữ sang hệ 4',
  minGroups: 'Số nguồn dữ liệu cùng có dấu hiệu từ',
  minSeverity: 'Tính dấu hiệu từ mức',
  minAttempt: 'Từ lần học thứ',
  bump: 'Nâng thêm (bậc)',
  weights: 'Trọng số điểm rủi ro',
  attendance: 'Điểm danh',
  lms: 'Bài kiểm tra LMS',
  academic: 'Học lực',
  freshnessDays: 'Số liệu điểm danh cũ quá (ngày) thì coi là quá hạn',
  normalizer: 'Tỷ lệ vắng ứng với rủi ro tối đa (0–1)',
  participationThreshold: 'Bài đến hạn khi tỷ lệ sinh viên đã nộp từ (0–1)',
  graceDays: 'và đã qua (ngày) kể từ lượt làm đầu tiên',
  passScore: 'Điểm đạt (thang 10)',
};

/** Nhãn giá trị liệt kê trong `condition` (mức cảnh báo dùng SEVERITY_LABELS). */
export const CONDITION_ENUM_LABELS: Record<string, string> = {
  PLANNED: 'Tổng buổi theo kế hoạch',
  HELD: 'Số buổi đã học',
  gte: 'Từ (≥)',
  gt: 'Vượt quá (>)',
};

export function conditionFieldLabel(ruleCode: string, key: string): string {
  return CONDITION_FIELD_LABELS[`${ruleCode}:${key}`] ?? CONDITION_FIELD_LABELS[key] ?? key;
}

/** Loại cảnh báo chất lượng dữ liệu trong kết quả lần chạy (docs/rules/08). */
export const DATA_WARNING_LABELS: Record<string, string> = {
  ATTENDANCE_DECREASED: 'Số buổi vắng giảm giữa 2 lần chốt (dữ liệu bị sửa)',
  ATTENDANCE_INVALID: 'Số liệu điểm danh không hợp lệ',
  QUIZ_MAX_SCORE_MISSING: 'Bài kiểm tra thiếu thang điểm tối đa',
  UNKNOWN_LETTER_GRADE: 'Điểm chữ không có trong bảng quy đổi',
};
