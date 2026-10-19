import { In, LessThan, LessThanOrEqual } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { LmsActivity } from '@/db/entities/lms-activity.entity';
import { LmsAssignmentSubmission } from '@/db/entities/lms-assignment-submission.entity';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { Term } from '@/db/entities/term.entity';
import { EnrollmentStatus } from '@/db/enums';
import { type RiskScoreConfig } from '../evaluator/config';
import { buildLmsGroups, type LmsGroupMember, NO_LMS } from '../evaluator/lms-groups';
import {
  type EnrollmentInput,
  type LmsGroupContext,
  type PreviousTermInput,
  type PriorAttemptInput,
  type StudentInput,
  type TermResultInput,
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

/** Học kỳ liền trước theo `Term.startDate` (ACA-04, RiskScore học lực — docs/rules/08). */
export async function findPreviousTerm(em: EntityManager, term: Term): Promise<Term | null> {
  return em.findOne(Term, {
    where: { startDate: LessThan(term.startDate) },
    order: { startDate: 'DESC' },
  });
}

/** Bối cảnh LMS (bài đến hạn) của mọi Enrollment trong học kỳ — tính từng học phần một. */
export async function loadLmsContexts(
  em: EntityManager,
  termId: string,
  asOf: Date,
  params: RiskScoreConfig['lms'],
): Promise<Map<string, LmsGroupContext>> {
  const activities = await em.find(LmsActivity, { where: { termId } });
  const contexts = new Map<string, LmsGroupContext>();
  for (const courseId of new Set(activities.map((a) => a.courseId))) {
    const enrollments = await em.find(Enrollment, {
      select: { enrollmentId: true, enrollmentStatus: true, sectionCode: true },
      where: { termId, courseId },
    });
    const ids = enrollments.map((e) => e.enrollmentId);
    const [attempts, submissions] = await Promise.all([
      em.find(LmsQuizAttempt, {
        select: { enrollmentId: true, activityId: true, startedAt: true, status: true },
        where: { enrollmentId: In(ids), startedAt: LessThanOrEqual(asOf) },
      }),
      em.find(LmsAssignmentSubmission, {
        select: { enrollmentId: true, activityId: true, submittedAt: true },
        where: { enrollmentId: In(ids) },
      }),
    ]);
    const members: LmsGroupMember[] = enrollments.map((e) => ({
      enrollmentId: e.enrollmentId,
      withdrawn: e.enrollmentStatus === EnrollmentStatus.WITHDRAWN,
      sectionCode: e.sectionCode,
      attempts: attempts.filter((a) => a.enrollmentId === e.enrollmentId),
      submissions: submissions.filter((s) => s.enrollmentId === e.enrollmentId),
    }));
    const courseActivities = activities
      .filter((a) => a.courseId === courseId)
      .map((a) => ({
        activityId: a.id,
        activityType: a.activityType,
        name: a.activityName,
        sectionCode: a.sectionCode,
        dueAt: a.dueAt,
      }));
    for (const [id, ctx] of buildLmsGroups(courseActivities, members, asOf, params)) {
      contexts.set(id, ctx);
    }
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
        result: r ? { passed: r.passed, publishedAt: r.publishedAt } : null,
      },
    ]);
  }
  return byPair;
}

/** Kết quả học phần (công bố ≤ asOf) của học kỳ liền trước, theo sinh viên. */
async function loadPreviousResults(
  em: EntityManager,
  previous: Term,
  studentIds: string[],
  asOf: Date,
): Promise<Map<string, TermResultInput[]>> {
  const rows = await em
    .createQueryBuilder(CourseResult, 'r')
    .innerJoinAndSelect('r.enrollment', 'e')
    .innerJoinAndSelect('e.course', 'c')
    .where('e.termId = :termId', { termId: previous.termId })
    .andWhere('e.studentId IN (:...ids)', { ids: studentIds })
    .andWhere('e.enrollmentStatus <> :withdrawn', { withdrawn: EnrollmentStatus.WITHDRAWN })
    .andWhere('r.publishedAt <= :asOf', { asOf })
    .getMany();
  const byStudent = new Map<string, TermResultInput[]>();
  for (const r of rows) {
    const e = r.enrollment;
    if (!e) continue;
    byStudent.set(e.studentId, [
      ...(byStudent.get(e.studentId) ?? []),
      {
        courseId: e.courseId,
        courseName: e.course?.courseName ?? e.courseId,
        credits: e.course?.credits ?? null,
        letterGrade: r.letterGrade,
        passed: r.passed,
        publishedAt: r.publishedAt,
      },
    ]);
  }
  return byStudent;
}

/** Khóa tuyển sinh (lớp sinh hoạt) của sinh viên — học kỳ đầu khóa = `HK1_{khóa}` (docs/rules/09). */
async function loadCohorts(em: EntityManager, studentIds: string[]): Promise<Map<string, string>> {
  const rows: { student_id: string; cohort_year: string }[] = await em.query(
    `SELECT s.student_id, c.cohort_year
       FROM students s JOIN administrative_classes c ON c.class_id = s.class_id
      WHERE s.student_id = ANY($1::varchar[])`,
    [studentIds],
  );
  return new Map(rows.map((r) => [r.student_id, r.cohort_year.trim()]));
}

/** `HK1_{khóa}` khi khóa là năm 4 chữ số; không thì không có học kỳ đầu khóa. */
export function firstTermIdOf(cohortYear: string | undefined): string | null {
  return cohortYear && /^\d{4}$/.test(cohortYear) ? `HK1_${cohortYear}` : null;
}

/** Dữ liệu đầu vào evaluator cho 1 lô sinh viên trong học kỳ. */
export async function loadStudentInputs(
  em: EntityManager,
  terms: { term: Term; previousTerm: Term | null },
  studentIds: string[],
  asOf: Date,
  lmsContexts: ReadonlyMap<string, LmsGroupContext>,
): Promise<StudentInput[]> {
  const { term, previousTerm } = terms;
  const enrollments = await em.find(Enrollment, {
    relations: { course: true },
    where: { termId: term.termId, studentId: In(studentIds) },
    order: { courseId: 'ASC' },
  });
  const ids = enrollments.map((e) => e.enrollmentId);
  const [snapshots, attempts, submissions, results, prior, previous, cohorts] = await Promise.all([
    em.find(AttendanceSummary, {
      where: { enrollmentId: In(ids), snapshotDate: LessThanOrEqual(asOf) },
    }),
    em.find(LmsQuizAttempt, { where: { enrollmentId: In(ids), startedAt: LessThanOrEqual(asOf) } }),
    em.find(LmsAssignmentSubmission, { where: { enrollmentId: In(ids) } }),
    em.find(CourseResult, { where: { enrollmentId: In(ids) } }),
    loadPriorAttempts(em, term, studentIds, [...new Set(enrollments.map((e) => e.courseId))]),
    previousTerm
      ? loadPreviousResults(em, previousTerm, studentIds, asOf)
      : Promise.resolve(new Map<string, TermResultInput[]>()),
    loadCohorts(em, studentIds),
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
          totalPeriods: s.totalPeriods,
          excusedAbsence: s.excusedAbsence,
          unexcusedAbsence: s.unexcusedAbsence,
        })),
      quizAttempts: attempts
        .filter((a) => a.enrollmentId === e.enrollmentId)
        .map((a) => ({
          activityId: a.activityId,
          attemptNumber: a.attemptNumber,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          score: a.score,
          maxScore: a.maxScore,
          correctCount: a.correctCount,
          totalQuestions: a.totalQuestions,
          status: a.status,
        })),
      submissions: submissions
        .filter((s) => s.enrollmentId === e.enrollmentId)
        .map((s) => ({ activityId: s.activityId, status: s.status, submittedAt: s.submittedAt })),
      result: r
        ? {
            letterGrade: r.letterGrade,
            passed: r.passed,
            eligibleForExam: r.eligibleForExam,
            absentFromExam: r.absentFromExam,
            publishedAt: r.publishedAt,
          }
        : null,
      priorAttempts: prior.get(`${e.studentId}|${e.courseId}`) ?? [],
      lms: lmsContexts.get(e.enrollmentId) ?? NO_LMS,
    };
  };

  return studentIds.map((studentId): StudentInput => {
    const firstTermId = firstTermIdOf(cohorts.get(studentId));
    const previousResults = previous.get(studentId) ?? [];
    const previousInput: PreviousTermInput | null =
      previousTerm && previousResults.length > 0
        ? {
            termId: previousTerm.termId,
            termName: previousTerm.termName,
            isFirstTerm: firstTermId === previousTerm.termId,
            results: previousResults,
          }
        : null;
    return {
      studentId,
      termId: term.termId,
      termName: term.termName,
      isFirstTerm: firstTermId === term.termId,
      enrollments: enrollments.filter((e) => e.studentId === studentId).map(toInput),
      previousTerm: previousInput,
    };
  });
}
