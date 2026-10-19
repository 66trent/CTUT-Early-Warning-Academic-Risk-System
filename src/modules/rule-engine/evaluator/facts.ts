import { DataStatus } from '@/db/enums';
import { type RiskScoreConfig } from './config';
import { DAY_MS } from './helpers';
import {
  type AttendanceSnapshotInput,
  type EnrollmentFacts,
  type EnrollmentInput,
  type EnrollmentState,
} from './types';

const byDate = (a: AttendanceSnapshotInput, b: AttendanceSnapshotInput) =>
  a.snapshotDate.getTime() - b.snapshotDate.getTime();

/** Bước 1: snapshot mâu thuẫn (tiết vắng vượt tổng số tiết, tổng tiết ≤ 0) → INVALID. */
export function isInvalidSnapshot(s: AttendanceSnapshotInput): boolean {
  return (
    s.totalPeriods <= 0 ||
    s.excusedAbsence < 0 ||
    s.unexcusedAbsence < 0 ||
    s.excusedAbsence + s.unexcusedAbsence > s.totalPeriods
  );
}

/** DataStatus nhóm điểm danh của 1 Enrollment tại asOf (docs/rules/08). */
function attendanceFacts(
  snapshots: readonly AttendanceSnapshotInput[],
  asOf: Date,
  freshnessDays: number,
): EnrollmentFacts['attendance'] {
  const visible = snapshots.filter((s) => s.snapshotDate <= asOf).sort(byDate);
  const latest = visible.at(-1) ?? null;
  const previous = visible.at(-2) ?? null;
  if (!latest) return { status: DataStatus.MISSING, latest, previous };
  if (isInvalidSnapshot(latest)) return { status: DataStatus.INVALID, latest, previous };
  const ageDays = (asOf.getTime() - latest.snapshotDate.getTime()) / DAY_MS;
  return {
    status: ageDays > freshnessDays ? DataStatus.STALE : DataStatus.AVAILABLE,
    latest,
    previous,
  };
}

/** Bài thực hành đã nộp TẠI asOf (`submittedAt ≤ asOf`) → thời điểm nộp. */
function submittedByAsOf(input: EnrollmentInput, asOf: Date): Map<string, Date> {
  const submitted = new Map<string, Date>();
  for (const s of input.submissions) {
    if (s.submittedAt && s.submittedAt <= asOf) submitted.set(s.activityId, s.submittedAt);
  }
  return submitted;
}

/**
 * Bước 1–4 cho 1 Enrollment: chỉ dùng dữ liệu phát sinh đến `asOf` (lọc lại ở đây dù nguồn đã
 * lọc — chống rò rỉ thời gian), suy ra trạng thái, lần học và DataStatus TẠI asOf.
 */
export function buildEnrollmentFacts(
  input: EnrollmentInput,
  asOf: Date,
  config: RiskScoreConfig,
): EnrollmentFacts {
  const result = input.result && input.result.publishedAt <= asOf ? input.result : null;
  const state: EnrollmentState = input.withdrawn
    ? 'WITHDRAWN'
    : result
      ? 'COMPLETED'
      : 'REGISTERED';
  const failedTerms = input.priorAttempts
    .filter((p) => p.result?.passed === false && p.result.publishedAt <= asOf)
    .map((p) => ({ termId: p.termId, termName: p.termName }));

  return {
    input,
    state,
    attemptNumber: 1 + failedTerms.length,
    failedTerms,
    attendance: attendanceFacts(input.attendance, asOf, config.attendance.freshnessDays),
    quiz: {
      status: input.lms.quizApplicable ? DataStatus.AVAILABLE : DataStatus.NOT_APPLICABLE,
      dueQuizzes: input.lms.dueQuizzes,
      attempts: input.quizAttempts.filter((a) => a.startedAt <= asOf),
    },
    assignment: {
      status: input.lms.assignmentApplicable ? DataStatus.AVAILABLE : DataStatus.NOT_APPLICABLE,
      dueAssignments: input.lms.dueAssignments,
      submittedAt: submittedByAsOf(input, asOf),
      dueAt: input.lms.assignmentDueAt,
    },
    result,
  };
}
