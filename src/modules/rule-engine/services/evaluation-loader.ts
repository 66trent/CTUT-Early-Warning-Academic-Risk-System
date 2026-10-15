import { In, LessThan, LessThanOrEqual } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { type Term } from '@/db/entities/term.entity';
import { EnrollmentStatus } from '@/db/enums';
import { type RiskScoreConfig } from '../evaluator/config';
import { buildLmsGroups, type LmsGroupMember } from '../evaluator/lms-groups';
import {
  type EnrollmentInput,
  type LmsGroupContext,
  type PriorAttemptInput,
  type StudentInput,
} from '../evaluator/types';

/**
 * Nạp dữ liệu từ DB cho evaluator (docs/rules/05: theo lô sinh viên, không nạp cả học kỳ).
 * Chỉ dữ liệu phát sinh đến `asOf` (evaluator lọc lại lần nữa). Dữ liệu nguồn đọc qua Enrollment.
 */

/** Sinh viên có Enrollment trong học kỳ (tùy chọn 1 học phần), sắp theo mã. */
export async function listTermStudents(
  em: EntityManager,
  termId: string,
  courseId: string | null,
): Promise<string[]> {
  const qb = em
    .createQueryBuilder(Enrollment, 'e')
    .select('DISTINCT e.studentId', 'studentId')
    .where('e.termId = :termId', { termId })
    .orderBy('"studentId"');
  if (courseId) qb.andWhere('e.courseId = :courseId', { courseId });
  const rows = await qb.getRawMany<{ studentId: string }>();
  return rows.map((r) => r.studentId);
}

const NO_LMS: LmsGroupContext = { applicable: false, groupKey: '', groupSize: 0, dueQuizzes: [] };

/** `sectionCode` của snapshot điểm danh mới nhất (≤ asOf) của từng Enrollment. */
async function latestAttendanceSections(
  em: EntityManager,
  enrollmentIds: string[],
  asOf: Date,
): Promise<Map<string, string | null>> {
  const rows: { enrollment_id: string; section_code: string | null }[] = await em.query(
    `SELECT DISTINCT ON (enrollment_id) enrollment_id, section_code
       FROM attendance_summaries
      WHERE enrollment_id = ANY($1::uuid[]) AND snapshot_date <= $2
      ORDER BY enrollment_id, snapshot_date DESC`,
    [enrollmentIds, asOf],
  );
  return new Map(rows.map((r) => [r.enrollment_id, r.section_code]));
}

/** Nhóm LMS ("bài đến hạn") của mọi Enrollment trong học kỳ — tính từng học phần một. */
export async function loadLmsContexts(
  em: EntityManager,
  termId: string,
  asOf: Date,
  params: RiskScoreConfig['lms'],
): Promise<Map<string, LmsGroupContext>> {
  const courses = await em
    .createQueryBuilder(Enrollment, 'e')
    .select('DISTINCT e.courseId', 'courseId')
    .where('e.termId = :termId', { termId })
    .getRawMany<{ courseId: string }>();
  const contexts = new Map<string, LmsGroupContext>();
  for (const { courseId } of courses) {
    const enrollments = await em.find(Enrollment, {
      select: { enrollmentId: true, enrollmentStatus: true },
      where: { termId, courseId },
    });
    const ids = enrollments.map((e) => e.enrollmentId);
    const [attempts, sections] = await Promise.all([
      em.find(LmsQuizAttempt, {
        select: {
          enrollmentId: true,
          quizKey: true,
          quizName: true,
          startedAt: true,
          status: true,
          sectionCode: true,
        },
        where: { enrollmentId: In(ids), startedAt: LessThanOrEqual(asOf) },
        order: { startedAt: 'ASC' },
      }),
      latestAttendanceSections(em, ids, asOf),
    ]);
    const members: LmsGroupMember[] = enrollments.map((e) => ({
      enrollmentId: e.enrollmentId,
      withdrawn: e.enrollmentStatus === EnrollmentStatus.WITHDRAWN,
      attendanceSection: sections.get(e.enrollmentId) ?? null,
      attempts: attempts
        .filter((a) => a.enrollmentId === e.enrollmentId)
        .map((a) => ({
          quizKey: a.quizKey,
          quizName: a.quizName,
          startedAt: a.startedAt,
          status: a.status,
          sectionCode: a.sectionCode,
        })),
    }));
    for (const [id, ctx] of buildLmsGroups(members, asOf, params)) contexts.set(id, ctx);
  }
  return contexts;
}

/** Các lần học cùng học phần ở học kỳ TRƯỚC (theo `Term.startDate`) kèm kết quả. */
async function loadPriorAttempts(
  em: EntityManager,
  term: Term,
  studentIds: string[],
  courseIds: string[],
): Promise<Map<string, PriorAttemptInput[]>> {
  if (courseIds.length === 0) return new Map();
  const prior = await em.find(Enrollment, {
    relations: { term: true },
    where: {
      studentId: In(studentIds),
      courseId: In(courseIds),
      term: { startDate: LessThan(term.startDate) },
    },
  });
  const results = await em.find(CourseResult, {
    where: { enrollmentId: In(prior.map((p) => p.enrollmentId)) },
  });
  const resultOf = new Map(results.map((r) => [r.enrollmentId, r]));
  const byPair = new Map<string, PriorAttemptInput[]>();
  for (const p of prior) {
    const r = resultOf.get(p.enrollmentId);
    const key = `${p.studentId}|${p.courseId}`;
    byPair.set(key, [
      ...(byPair.get(key) ?? []),
      {
        termId: p.termId,
        termName: p.term?.termName ?? p.termId,
        result: r
          ? { resultStatus: r.resultStatus, passed: r.passed, publishedAt: r.publishedAt }
          : null,
      },
    ]);
  }
  return byPair;
}

/** Dữ liệu đầu vào evaluator cho 1 lô sinh viên trong học kỳ. */
export async function loadStudentInputs(
  em: EntityManager,
  term: Term,
  studentIds: string[],
  asOf: Date,
  lmsContexts: ReadonlyMap<string, LmsGroupContext>,
): Promise<StudentInput[]> {
  const enrollments = await em.find(Enrollment, {
    relations: { course: true },
    where: { termId: term.termId, studentId: In(studentIds) },
    order: { courseId: 'ASC' },
  });
  const ids = enrollments.map((e) => e.enrollmentId);
  const [snapshots, attempts, results, prior] = await Promise.all([
    em.find(AttendanceSummary, {
      where: { enrollmentId: In(ids), snapshotDate: LessThanOrEqual(asOf) },
    }),
    em.find(LmsQuizAttempt, { where: { enrollmentId: In(ids), startedAt: LessThanOrEqual(asOf) } }),
    em.find(CourseResult, { where: { enrollmentId: In(ids) } }),
    loadPriorAttempts(em, term, studentIds, [...new Set(enrollments.map((e) => e.courseId))]),
  ]);
  const resultOf = new Map(results.map((r) => [r.enrollmentId, r]));

  const toInput = (e: Enrollment): EnrollmentInput => {
    const r = resultOf.get(e.enrollmentId);
    return {
      enrollmentId: e.enrollmentId,
      courseId: e.courseId,
      courseName: e.course?.courseName ?? e.courseId,
      credits: e.course?.credits ?? null,
      withdrawn: e.enrollmentStatus === EnrollmentStatus.WITHDRAWN,
      attendance: snapshots
        .filter((s) => s.enrollmentId === e.enrollmentId)
        .map((s) => ({
          snapshotDate: s.snapshotDate,
          totalSessions: s.totalSessions,
          plannedSessions: s.plannedSessions,
          present: s.present,
          late: s.late,
          excusedAbsence: s.excusedAbsence,
          unexcusedAbsence: s.unexcusedAbsence,
          sectionCode: s.sectionCode,
        })),
      quizAttempts: attempts
        .filter((a) => a.enrollmentId === e.enrollmentId)
        .map((a) => ({
          quizKey: a.quizKey,
          quizName: a.quizName,
          attemptNumber: a.attemptNumber,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          score: a.score,
          maxScore: a.maxScore,
          status: a.status,
        })),
      result: r
        ? {
            processScore: r.processScore,
            finalScore: r.finalScore,
            letterGrade: r.letterGrade,
            passed: r.passed,
            resultStatus: r.resultStatus,
            publishedAt: r.publishedAt,
            processPublishedAt: r.processPublishedAt,
          }
        : null,
      priorAttempts: prior.get(`${e.studentId}|${e.courseId}`) ?? [],
      lmsGroup: lmsContexts.get(e.enrollmentId) ?? NO_LMS,
    };
  };

  return studentIds.map((studentId) => ({
    studentId,
    termId: term.termId,
    termName: term.termName,
    enrollments: enrollments.filter((e) => e.studentId === studentId).map(toInput),
  }));
}
