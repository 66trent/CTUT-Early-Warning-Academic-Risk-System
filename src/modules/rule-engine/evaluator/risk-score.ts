import { DataCompletenessLevel, DataStatus } from '@/db/enums';
import type { RiskComponent } from '@/db/entities/risk-score-log.entity';
import { type RiskScoreConfig } from './config';
import { missedDueQuizzes } from './rules/lms-01';
import { type EnrollmentFacts } from './types';

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

function attendanceComponent(facts: EnrollmentFacts[], c: RiskScoreConfig): RiskComponent {
  const status = groupStatus(facts.map((f) => f.attendance.status));
  let absences = 0;
  let denominator = 0;
  for (const f of facts) {
    const s = f.attendance.latest;
    if (f.attendance.status !== DataStatus.AVAILABLE || !s) continue;
    absences += s.unexcusedAbsence + (c.attendance.countExcused ? s.excusedAbsence : 0);
    denominator +=
      c.attendance.denominator === 'PLANNED'
        ? (s.plannedSessions ?? s.totalSessions)
        : s.totalSessions;
  }
  const raw = status === DataStatus.AVAILABLE && denominator > 0 ? absences / denominator : null;
  return {
    group: 'ATTENDANCE',
    status: raw === null && status === DataStatus.AVAILABLE ? DataStatus.MISSING : status,
    weight: c.weights.attendance,
    rawValue: raw,
    normalized: raw === null ? null : clamp01(raw / c.attendance.normalizer),
  };
}

function lmsComponent(facts: EnrollmentFacts[], c: RiskScoreConfig): RiskComponent {
  const status = groupStatus(facts.map((f) => f.lms.status));
  let missed = 0;
  let due = 0;
  for (const f of facts) {
    if (f.lms.status !== DataStatus.AVAILABLE) continue;
    missed += missedDueQuizzes(f).length;
    due += f.lms.dueQuizzes.length;
  }
  const raw = status === DataStatus.AVAILABLE ? (due === 0 ? 0 : missed / due) : null;
  return {
    group: 'LMS',
    status,
    weight: c.weights.lms,
    rawValue: raw,
    normalized: raw,
  };
}

function academicComponent(facts: EnrollmentFacts[], c: RiskScoreConfig): RiskComponent {
  const scores = facts
    .map((f) => f.result?.finalScore ?? f.result?.processScore ?? null)
    .filter((s): s is number => s !== null);
  const raw = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const pass = c.academic.passScore;
  return {
    group: 'ACADEMIC',
    status: raw === null ? DataStatus.MISSING : DataStatus.AVAILABLE,
    weight: c.weights.academic,
    rawValue: raw,
    normalized: raw === null ? null : clamp01((pass - raw) / pass),
  };
}

/**
 * RiskScore 1 sinh viên × học kỳ (docs/rules/00, 08) — CHỈ để hiển thị/sắp xếp, không tạo cảnh
 * báo. Gộp học phần bằng cộng dồn số liệu; nhóm không AVAILABLE bị loại khỏi tử và mẫu.
 * FULL = mọi nhóm áp dụng được đều AVAILABLE; INSUFFICIENT = không nhóm nào AVAILABLE.
 */
export function computeRiskScore(
  facts: readonly EnrollmentFacts[],
  config: RiskScoreConfig,
): RiskScoreResult {
  const active = facts.filter((f) => f.state !== 'WITHDRAWN');
  const components = [
    attendanceComponent(active, config),
    lmsComponent(active, config),
    academicComponent(active, config),
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
