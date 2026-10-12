import { CourseResultStatus, DataStatus } from '@/db/enums';
import { type RiskScoreConfig } from './config';
import { DAY_MS } from './helpers';
import {
  type AttendanceSnapshotInput,
  type CourseResultInput,
  type EnrollmentFacts,
  type EnrollmentInput,
  type EnrollmentState,
} from './types';

const byDate = (a: AttendanceSnapshotInput, b: AttendanceSnapshotInput) =>
  a.snapshotDate.getTime() - b.snapshotDate.getTime();

/** Bước 1: snapshot mâu thuẫn (tổng các cột trạng thái > số buổi đã học) → INVALID. */
export function isInvalidSnapshot(s: AttendanceSnapshotInput): boolean {
  const counts = [s.present, s.late, s.excusedAbsence, s.unexcusedAbsence, s.totalSessions];
  return (
    counts.some((n) => n < 0) ||
    s.present + s.late + s.excusedAbsence + s.unexcusedAbsence > s.totalSessions
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

/**
 * Kết quả học phần TẠI asOf: công bố sau asOf thì không thấy; riêng kết quả đã FINAL nhưng điểm
 * quá trình công bố trước asOf → thấy như PROCESS_ONLY (mỗi học phần chỉ 1 dòng kết quả, dòng
 * FINAL ghi đè dòng giữa kỳ — chống rò rỉ thời gian khi chạy lại mốc giữa kỳ).
 */
export function asOfResult(result: CourseResultInput | null, asOf: Date): CourseResultInput | null {
  if (!result) return null;
  if (result.publishedAt <= asOf) return result;
  if (result.processScore === null || !result.processPublishedAt) return null;
  if (result.processPublishedAt > asOf) return null;
  return {
    processScore: result.processScore,
    finalScore: null,
    letterGrade: null,
    passed: null,
    resultStatus: CourseResultStatus.PROCESS_ONLY,
    publishedAt: result.processPublishedAt,
    processPublishedAt: result.processPublishedAt,
  };
}

/**
 * Bước 1–4 cho 1 Enrollment: chỉ dùng dữ liệu phát sinh đến `asOf` (lọc lại ở đây dù nguồn
 * đã lọc — chống rò rỉ thời gian), suy ra trạng thái, lần học và DataStatus TẠI asOf.
 */
export function buildEnrollmentFacts(
  input: EnrollmentInput,
  asOf: Date,
  config: RiskScoreConfig,
): EnrollmentFacts {
  const result = asOfResult(input.result, asOf);
  const state: EnrollmentState = input.withdrawn
    ? 'WITHDRAWN'
    : result?.resultStatus === CourseResultStatus.FINAL
      ? 'COMPLETED'
      : 'REGISTERED';
  const failedTerms = input.priorAttempts
    .filter(
      (p) =>
        p.result?.resultStatus === CourseResultStatus.FINAL &&
        p.result.passed === false &&
        p.result.publishedAt <= asOf,
    )
    .map((p) => ({ termId: p.termId, termName: p.termName }));

  return {
    input,
    state,
    attemptNumber: 1 + failedTerms.length,
    failedTerms,
    attendance: attendanceFacts(input.attendance, asOf, config.attendance.freshnessDays),
    lms: {
      status: input.lmsGroup.applicable ? DataStatus.AVAILABLE : DataStatus.NOT_APPLICABLE,
      dueQuizzes: input.lmsGroup.dueQuizzes,
      attempts: input.quizAttempts.filter((a) => a.startedAt <= asOf),
    },
    result,
  };
}
