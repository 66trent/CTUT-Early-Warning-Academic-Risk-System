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
  [EvaluationTrigger.TERM_CLOSING]: 'Chốt học kỳ (lần cuối)',
};

export const RULE_GROUP_LABELS: Record<RuleGroup, string> = {
  [RuleGroup.ATTENDANCE]: 'Điểm danh',
  [RuleGroup.LMS]: 'LMS (trắc nghiệm, thực hành)',
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
    'Tỷ lệ tiết vắng (có phép + không phép) trên tổng số tiết của học phần. Quy chế: vắng vượt quá 20% bị cấm thi — hệ thống chỉ cảnh báo, không ghi điểm.',
  'ATT-02':
    'Số tiết vắng không phép tăng nhanh giữa 2 lần chốt điểm danh gần nhau (theo % tổng số tiết).',
  'LMS-01': 'Số bài trắc nghiệm đã quá hạn mà sinh viên chưa làm.',
  'LMS-02': 'Điểm các bài trắc nghiệm gần nhất đã nộp đều thấp hơn ngưỡng.',
  'LMS-03': 'Số bài thực hành đã quá hạn mà sinh viên chưa nộp (chỉ dựa trạng thái nộp).',
  'LMS-04': 'Số bài thực hành nộp trễ. Mức thấp chỉ hiện trong ứng dụng, không gửi email.',
  'ACA-01':
    'Học phần không đạt (điểm F, kể cả không được dự thi, vắng thi) — báo ngay khi học phần khóa điểm.',
  'ACA-02':
    'Tỷ lệ tín chỉ không đạt trong học kỳ. Quy chế 336 Điều 11a: vượt 50% là ngưỡng cảnh báo học tập.',
  'ACA-03':
    'Điểm trung bình học kỳ hệ 4 (A = 3,8). Quy chế 336 Điều 11b: dưới 1,0 (học kỳ đầu khóa dưới 0,8) là ngưỡng cảnh báo học tập.',
  'ACA-04':
    'So với học kỳ liền trước: điểm trung bình giảm nhiều, hoặc 2 học kỳ liên tiếp chạm ngưỡng quy chế.',
  'COMB-01': 'Nhiều nguồn (điểm danh, trắc nghiệm, thực hành) cùng có dấu hiệu trên 1 học phần.',
  'COMB-02': 'Đang học lại học phần đã rớt mà vẫn có dấu hiệu điểm danh hoặc LMS.',
  'RISK-SCORE':
    'Trọng số điểm rủi ro tổng hợp và tham số dữ liệu dùng chung (độ mới điểm danh, bài trắc nghiệm đến hạn, quy đổi điểm chữ).',
};

/** Nhãn trường trong `condition`. Khóa dạng `MÃ_LUẬT:trường` ghi đè nhãn chung khi nghĩa khác. */
export const CONDITION_FIELD_LABELS: Record<string, string> = {
  countExcused: 'Tính cả tiết vắng có phép',
  bands: 'Các mức cảnh báo',
  percent: 'Tỷ lệ (%)',
  'ATT-01:percent': 'Tỷ lệ vắng (%)',
  'ACA-02:percent': 'Tỷ lệ tín chỉ không đạt (%)',
  op: 'So sánh',
  severity: 'Mức cảnh báo',
  windowDays: 'Hai lần chốt cách nhau tối đa (ngày)',
  minIncreasePercent: 'Tiết vắng không phép tăng từ (% tổng số tiết)',
  minCount: 'Số bài từ',
  'LMS-01:minCount': 'Số bài trắc nghiệm bỏ từ',
  'LMS-03:minCount': 'Số bài thực hành không nộp từ',
  minLate: 'Số bài nộp trễ từ',
  recentCount: 'Số bài gần nhất cần xét',
  thresholdPercent: 'Điểm dưới (% thang điểm của bài)',
  minCredits: 'Chỉ xét khi tổng tín chỉ có điểm từ',
  warnBelow: 'Mức báo sớm: điểm trung bình dưới',
  warnSeverity: 'Mức cảnh báo (báo sớm)',
  regulationBelow: 'Ngưỡng quy chế: điểm trung bình dưới',
  firstTermRegulationBelow: 'Ngưỡng quy chế học kỳ đầu khóa: dưới',
  regulationSeverity: 'Mức cảnh báo (chạm ngưỡng quy chế)',
  minDrop: 'Điểm trung bình giảm từ (so với học kỳ trước)',
  dropSeverity: 'Mức cảnh báo khi giảm',
  consecutiveMinSeverity: 'Hai học kỳ liên tiếp cùng có mức từ',
  consecutiveSeverity: 'Mức cảnh báo khi liên tiếp',
  gradeScale: 'Quy đổi điểm chữ sang hệ 4',
  safeGpa: 'Điểm trung bình an toàn (rủi ro học lực = 0)',
  minGroups: 'Số nguồn dữ liệu cùng có dấu hiệu từ',
  minSeverity: 'Tính dấu hiệu từ mức',
  minAttempt: 'Từ lần học thứ',
  bump: 'Nâng thêm (bậc)',
  weights: 'Trọng số điểm rủi ro',
  attendance: 'Điểm danh',
  lms: 'LMS',
  academic: 'Học lực',
  freshnessDays: 'Số liệu điểm danh cũ quá (ngày) thì coi là quá hạn',
  normalizer: 'Tỷ lệ vắng ứng với rủi ro tối đa (0–1)',
  participationThreshold: 'Bài trắc nghiệm không có hạn nộp: đến hạn khi tỷ lệ đã nộp từ (0–1)',
  graceDays: 'và đã qua (ngày) kể từ lượt làm đầu tiên',
};

/** Nhãn giá trị liệt kê trong `condition` (mức cảnh báo dùng SEVERITY_LABELS). */
export const CONDITION_ENUM_LABELS: Record<string, string> = {
  gte: 'Từ (≥)',
  gt: 'Vượt quá (>)',
};

export function conditionFieldLabel(ruleCode: string, key: string): string {
  return CONDITION_FIELD_LABELS[`${ruleCode}:${key}`] ?? CONDITION_FIELD_LABELS[key] ?? key;
}

/** Loại cảnh báo chất lượng dữ liệu trong kết quả lần chạy (docs/rules/08). */
export const DATA_WARNING_LABELS: Record<string, string> = {
  ATTENDANCE_DECREASED: 'Số tiết vắng giảm giữa 2 lần chốt (dữ liệu bị sửa)',
  ATTENDANCE_INVALID: 'Số liệu điểm danh không hợp lệ',
  QUIZ_MAX_SCORE_MISSING: 'Bài trắc nghiệm thiếu thang điểm tối đa',
  COURSE_CREDITS_MISSING: 'Học phần chưa có số tín chỉ',
  UNKNOWN_LETTER_GRADE: 'Điểm chữ không có trong bảng quy đổi',
};
