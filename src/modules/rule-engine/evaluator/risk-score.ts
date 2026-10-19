import { DataCompletenessLevel, DataStatus } from '@/db/enums';
import type { RiskComponent } from '@/db/entities/risk-score-log.entity';
import { gpaValue, termAcademics, termResults } from './academic';
import { type RiskScoreConfig } from './config';
import { missedDueQuizzes } from './rules/lms-01';
import { missingAssignments } from './rules/lms-03';
import { type EnrollmentFacts, type PreviousTermInput } from './types';

export interface RiskScoreResult {
  value: number | null;
  level: DataCompletenessLevel;
  components: RiskComponent[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Gộp DataStatus nhiều Enrollment: có 1 AVAILABLE → AVAILABLE; tất cả N/A → N/A. */
function groupStatus(statuses: DataStatus[]): DataStatus {
  if (statuses.includes(DataStatus.AVAILABLE)) return DataStatus.AVAILABLE;
  if (statuses.length > 0 && statuses.every((s) => s === DataStatus.NOT_APPLICABLE)) {
    return DataStatus.NOT_APPLICABLE;
  }
  return statuses.find((s) => s !== DataStatus.NOT_APPLICABLE) ?? DataStatus.MISSING;
}

/** Điểm danh: Σ tiết vắng / Σ tổng số tiết trên các Enrollment điểm danh AVAILABLE. */
function attendanceComponent(facts: EnrollmentFacts[], c: RiskScoreConfig): RiskComponent {
  const status = groupStatus(facts.map((f) => f.attendance.status));
  let absences = 0;
  let periods = 0;
  for (const f of facts) {
    const s = f.attendance.latest;
    if (f.attendance.status !== DataStatus.AVAILABLE || !s) continue;
    absences += s.unexcusedAbsence + (c.attendance.countExcused ? s.excusedAbsence : 0);
    periods += s.totalPeriods;
  }
  const raw = status === DataStatus.AVAILABLE && periods > 0 ? absences / periods : null;
  return {
    group: 'ATTENDANCE',
    status: raw === null && status === DataStatus.AVAILABLE ? DataStatus.MISSING : status,
    weight: c.weights.attendance,
    rawValue: raw,
    normalized: raw === null ? null : clamp01(raw / c.attendance.normalizer),
  };
}

/** LMS: (bài trắc nghiệm bỏ + bài thực hành không nộp) / bài đã đến hạn của cả 2 loại. */
function lmsComponent(facts: EnrollmentFacts[], c: RiskScoreConfig): RiskComponent {
  const status = groupStatus(
    facts.map((f) =>
      f.quiz.status === DataStatus.AVAILABLE || f.assignment.status === DataStatus.AVAILABLE
        ? DataStatus.AVAILABLE
        : DataStatus.NOT_APPLICABLE,
    ),
  );
  let missed = 0;
  let due = 0;
  for (const f of facts) {
    if (f.quiz.status === DataStatus.AVAILABLE) {
      missed += missedDueQuizzes(f).length;
      due += f.quiz.dueQuizzes.length;
    }
    if (f.assignment.status === DataStatus.AVAILABLE) {
      missed += missingAssignments(f).length;
      due += f.assignment.dueAssignments.length;
    }
  }
  const raw = status === DataStatus.AVAILABLE ? (due === 0 ? 0 : missed / due) : null;
  return { group: 'LMS', status, weight: c.weights.lms, rawValue: raw, normalized: raw };
}

/**
 * Học lực (chốt 2026-10-18): ĐTB hệ 4 học kỳ này trên các học phần đã có kết quả; chưa có thì
 * ĐTB học kỳ liền trước. Chuẩn hóa (safeGpa − ĐTB) / safeGpa.
 */
function academicComponent(
  facts: EnrollmentFacts[],
  previousTerm: PreviousTermInput | null,
  c: RiskScoreConfig,
): RiskComponent {
  const scale = c.academic.gradeScale;
  const current = gpaValue(termAcademics(termResults(facts), scale));
  const previous =
    current === null && previousTerm ? gpaValue(termAcademics(previousTerm.results, scale)) : null;
  const raw = current ?? previous;
  const safe = c.academic.safeGpa;
  return {
    group: 'ACADEMIC',
    status: raw === null ? DataStatus.MISSING : DataStatus.AVAILABLE,
    weight: c.weights.academic,
    rawValue: raw,
    normalized: raw === null ? null : clamp01((safe - raw) / safe),
    ...(raw !== null ? { basis: current !== null ? 'CURRENT_TERM' : 'PREVIOUS_TERM' } : {}),
  };
}

/**
 * RiskScore 1 sinh viên × học kỳ (docs/rules/00, 08) — CHỈ để hiển thị/sắp xếp, không tạo cảnh
 * báo. Gộp học phần bằng cộng dồn số liệu; nhóm không AVAILABLE bị loại khỏi tử và mẫu.
 * FULL = mọi nhóm áp dụng được đều AVAILABLE; INSUFFICIENT = không nhóm nào AVAILABLE.
 */
export function computeRiskScore(
  facts: readonly EnrollmentFacts[],
  previousTerm: PreviousTermInput | null,
  config: RiskScoreConfig,
): RiskScoreResult {
  const active = facts.filter((f) => f.state !== 'WITHDRAWN');
  const components = [
    attendanceComponent(active, config),
    lmsComponent(active, config),
    academicComponent(active, previousTerm, config),
  ];
  const applicable = components.filter((x) => x.status !== DataStatus.NOT_APPLICABLE);
  const available = components.filter((x) => x.status === DataStatus.AVAILABLE);
  const weightSum = available.reduce((sum, x) => sum + x.weight, 0);
  if (available.length === 0 || weightSum === 0) {
    return { value: null, level: DataCompletenessLevel.INSUFFICIENT, components };
  }
  const value = available.reduce((sum, x) => sum + x.weight * (x.normalized ?? 0), 0) / weightSum;
  return {
    value,
    level:
      available.length === applicable.length
        ? DataCompletenessLevel.FULL
        : DataCompletenessLevel.PARTIAL,
    components,
  };
}
