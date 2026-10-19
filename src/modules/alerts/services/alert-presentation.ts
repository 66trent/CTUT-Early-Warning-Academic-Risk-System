/** Lời văn hiển thị cho dấu hiệu cảnh báo — dùng được ở client (không import DB). */
export type SignalSource = 'ATTENDANCE' | 'LMS' | 'ACADEMIC' | 'COMBINED';

/** Ngưỡng "quá hạn chưa xác nhận" (giờ thật) — người dùng chốt 7 ngày (docs/implement.md 8b–8d). */
export const OVERDUE_DAYS = 7;

export const SOURCE_LABELS: Record<SignalSource, string> = {
  ATTENDANCE: 'Điểm danh',
  LMS: 'Bài LMS (trắc nghiệm, thực hành)',
  ACADEMIC: 'Kết quả học tập',
  COMBINED: 'Kết hợp nhiều nguồn',
};

/** Nhãn trong câu tóm tắt (giữa câu, chữ thường — giữ nguyên "LMS"). */
export const SOURCE_INLINE_LABELS: Record<SignalSource, string> = {
  ATTENDANCE: 'điểm danh',
  LMS: 'bài LMS',
  ACADEMIC: 'kết quả học tập',
  COMBINED: 'kết hợp nhiều nguồn',
};

/** Nguồn của 1 luật theo tiền tố mã (docs/rules/08). */
export function sourceOf(ruleCode: string): SignalSource {
  if (ruleCode.startsWith('ATT')) return 'ATTENDANCE';
  if (ruleCode.startsWith('LMS')) return 'LMS';
  if (ruleCode.startsWith('ACA')) return 'ACADEMIC';
  return 'COMBINED';
}

/** Gợi ý hành động cho sinh viên theo nguồn — lời văn tích cực (docs/rules/07). */
export const STUDENT_SUGGESTIONS: Record<SignalSource, string> = {
  ATTENDANCE:
    'Tham gia đầy đủ các buổi học còn lại; nếu có lý do vắng, hãy trao đổi sớm với giảng viên học phần.',
  LMS: 'Hoàn thành các bài trắc nghiệm, bài thực hành còn thiếu trên hệ thống học trực tuyến và nộp đúng hạn.',
  ACADEMIC: 'Trao đổi với giảng viên học phần hoặc Cố vấn học tập để có kế hoạch ôn tập phù hợp.',
  COMBINED: 'Hẹn gặp Cố vấn học tập để cùng lập kế hoạch học tập cho học kỳ này.',
};

const EVIDENCE_LABELS: Record<string, string> = {
  snapshotDate: 'Ngày chốt số liệu',
  absences: 'Số tiết vắng (tính cảnh báo)',
  excusedAbsence: 'Vắng có phép (tiết)',
  unexcusedAbsence: 'Vắng không phép (tiết)',
  totalPeriods: 'Tổng số tiết học phần',
  rate: 'Tỷ lệ vắng',
  previousDate: 'Ngày chốt trước',
  previousUnexcused: 'Vắng không phép (lần trước)',
  latestDate: 'Ngày chốt gần nhất',
  latestUnexcused: 'Vắng không phép (gần nhất)',
  increase: 'Mức tăng (tiết)',
  days: 'Số ngày giữa 2 lần chốt',
  missedCount: 'Số bài trắc nghiệm bị bỏ',
  dueCount: 'Số bài đã đến hạn',
  missedQuizzes: 'Bài bị bỏ',
  missingCount: 'Số bài thực hành không nộp',
  missingAssignments: 'Bài không nộp',
  lateCount: 'Số bài nộp trễ',
  letterGrade: 'Điểm chữ',
  eligibleForExam: 'Được dự thi',
  absentFromExam: 'Vắng thi',
  publishedAt: 'Ngày công bố',
  failedCredits: 'Tín chỉ không đạt',
  failedCourses: 'Học phần không đạt',
  gpa4: 'Điểm trung bình hệ 4',
  credits: 'Số tín chỉ',
  threshold: 'Ngưỡng',
  firstTerm: 'Học kỳ đầu khóa',
  missingResults: 'Học phần chưa có kết quả',
  previousTermId: 'Học kỳ trước',
  previousGpa4: 'Điểm trung bình học kỳ trước',
  previousLevel: 'Mức học kỳ trước',
  level: 'Mức học kỳ này',
  groups: 'Nguồn',
  rules: 'Luật liên quan',
  attemptNumber: 'Lần học',
  failedTerms: 'Học kỳ đã không đạt',
  signals: 'Dấu hiệu đi kèm',
  quiz: 'Bài',
  score: 'Điểm',
  maxScore: 'Thang điểm',
};

function formatValue(key: string, value: string | number | boolean | null): string {
  if (value === null) return '—';
  if (key === 'rate' && typeof value === 'number')
    return `${(Math.round(value * 1000) / 10).toLocaleString('vi-VN')}%`;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return (Math.round(value * 100) / 100).toLocaleString('vi-VN');
  return String(value);
}

/** inputSnapshot → các dòng "nhãn: giá trị" dễ đọc cho Cố vấn học tập. */
export function evidenceRows(
  snapshot: Record<string, string | number | boolean | null>,
): { label: string; value: string }[] {
  const order = Object.keys(EVIDENCE_LABELS);
  const rank = (key: string) => {
    const i = order.indexOf(key.replace(/\d+$/, ''));
    return i === -1 ? order.length : i;
  };
  const entries = Object.entries(snapshot).sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b),
  );
  return entries.map(([key, value]) => {
    const quiz = /^(quiz|score|maxScore)(\d+)$/.exec(key);
    const label = quiz
      ? `${quiz[1] === 'quiz' ? 'Bài' : quiz[1] === 'score' ? 'Điểm' : 'Thang điểm'} ${quiz[2]}`
      : (EVIDENCE_LABELS[key] ?? key);
    return { label, value: formatValue(key, value) };
  });
}
