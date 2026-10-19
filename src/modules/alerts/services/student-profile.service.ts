import { In, Not } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { LmsActivity } from '@/db/entities/lms-activity.entity';
import { LmsAssignmentSubmission } from '@/db/entities/lms-assignment-submission.entity';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import {
  AlertStatus,
  type EnrollmentStatus,
  LmsActivityType,
  QuizAttemptStatus,
  Severity,
  SEVERITY_ORDER,
} from '@/db/enums';
import { type SignalSource, sourceOf, STUDENT_SUGGESTIONS } from './alert-presentation';
import { loadCurrentTriggers } from './current-signals';

export interface CourseSnapshotDto {
  enrollmentId: string;
  enrollmentStatus: EnrollmentStatus;
  courseId: string;
  courseName: string;
  credits: number | null;
  attemptNumber: number;
  /** Snapshot điểm danh mới nhất, đơn vị tiết. */
  attendance: {
    snapshotDate: string;
    absences: number;
    totalPeriods: number;
  } | null;
  /** Bài trắc nghiệm của lớp học phần: tổng số bài / số bài đã nộp. */
  quizzes: { total: number; submitted: number };
  /** Bài thực hành: tổng / đã nộp / nộp trễ / quá hạn chưa nộp (tính tại thời điểm xem). */
  assignments: { total: number; submitted: number; late: number; overdue: number };
  result: {
    letterGrade: string;
    passed: boolean;
    processScore: number | null;
    examScore: number | null;
    eligibleForExam: boolean | null;
    absentFromExam: boolean | null;
  } | null;
}

export interface StudentProfileDto {
  studentId: string;
  fullName: string;
  classId: string;
  termId: string;
  termName: string;
  /** Học kỳ đã chốt — không sửa dữ liệu (VD đánh dấu rút học phần) được nữa. */
  termClosed: boolean;
  courses: CourseSnapshotDto[];
}

/** Bài thực hành của 1 Enrollment: đã nộp / nộp trễ / quá hạn chưa nộp tại `now`. */
function assignmentSummary(
  assignments: readonly LmsActivity[],
  submissions: readonly LmsAssignmentSubmission[],
  now: Date,
): CourseSnapshotDto['assignments'] {
  let submitted = 0;
  let late = 0;
  let overdue = 0;
  for (const a of assignments) {
    const at = submissions.find((s) => s.activityId === a.id)?.submittedAt ?? null;
    if (at) {
      submitted += 1;
      if (a.dueAt && at > a.dueAt) late += 1;
    } else if (a.dueAt && a.dueAt <= now) {
      overdue += 1;
    }
  }
  return { total: assignments.length, submitted, late, overdue };
}

/** Số liệu từng học phần của 1 sinh viên trong học kỳ (snapshot điểm danh mới nhất). */
export async function getStudentProfile(
  studentId: string,
  termId: string,
): Promise<StudentProfileDto | null> {
  const ds = await getDataSource();
  const [student, term] = await Promise.all([
    ds.getRepository(Student).findOneBy({ studentId }),
    ds.getRepository(Term).findOneBy({ termId }),
  ]);
  if (!student || !term) return null;
  const enrollments = await ds.getRepository(Enrollment).find({
    where: { studentId, termId },
    relations: { course: true },
    order: { courseId: 'ASC' },
  });
  const ids = enrollments.map((e) => e.enrollmentId);
  const [snapshots, attempts, submissions, results, activities] = await Promise.all([
    ds.getRepository(AttendanceSummary).find({
      where: { enrollmentId: In(ids) },
      order: { snapshotDate: 'DESC' },
    }),
    ds.getRepository(LmsQuizAttempt).find({ where: { enrollmentId: In(ids) } }),
    ds.getRepository(LmsAssignmentSubmission).find({ where: { enrollmentId: In(ids) } }),
    ds.getRepository(CourseResult).find({ where: { enrollmentId: In(ids) } }),
    ds.getRepository(LmsActivity).find({
      where: { termId, courseId: In([...new Set(enrollments.map((e) => e.courseId))]) },
    }),
  ]);
  const now = new Date();
  return {
    studentId,
    fullName: student.fullName,
    classId: student.classId,
    termId,
    termName: term.termName,
    termClosed: term.closedAt !== null,
    courses: enrollments.map((e) => {
      const latest = snapshots.find((s) => s.enrollmentId === e.enrollmentId);
      const mine = attempts.filter((a) => a.enrollmentId === e.enrollmentId);
      const r = results.find((x) => x.enrollmentId === e.enrollmentId);
      const own = activities.filter(
        (a) =>
          a.courseId === e.courseId && (e.sectionCode === null || a.sectionCode === e.sectionCode),
      );
      return {
        enrollmentId: e.enrollmentId,
        enrollmentStatus: e.enrollmentStatus,
        courseId: e.courseId,
        courseName: e.course?.courseName ?? e.courseId,
        credits: e.course?.credits ?? null,
        attemptNumber: e.attemptNumber,
        attendance: latest
          ? {
              snapshotDate: latest.snapshotDate.toISOString(),
              absences: latest.excusedAbsence + latest.unexcusedAbsence,
              totalPeriods: latest.totalPeriods,
            }
          : null,
        quizzes: {
          total: own.filter((a) => a.activityType === LmsActivityType.QUIZ).length,
          submitted: new Set(
            mine.filter((a) => a.status === QuizAttemptStatus.SUBMITTED).map((a) => a.activityId),
          ).size,
        },
        assignments: assignmentSummary(
          own.filter((a) => a.activityType === LmsActivityType.ASSIGNMENT),
          submissions.filter((s) => s.enrollmentId === e.enrollmentId),
          now,
        ),
        result: r
          ? {
              letterGrade: r.letterGrade,
              passed: r.passed,
              processScore: r.processScore,
              examScore: r.examScore,
              eligibleForExam: r.eligibleForExam,
              absentFromExam: r.absentFromExam,
            }
          : null,
      };
    }),
  };
}

/** Trạng thái cảnh báo sinh viên được thấy — chỉ SAU KHI Cố vấn học tập xác nhận (docs/rules/06). */
export const STUDENT_VISIBLE_STATUSES: readonly AlertStatus[] = [
  AlertStatus.ACKNOWLEDGED,
  AlertStatus.IN_PROGRESS,
  AlertStatus.RESOLVED,
];

export interface StudentOverviewDto {
  profile: StudentProfileDto;
  /** "Cần chú ý" khi có cảnh báo đã xác nhận mức ≥ MEDIUM chưa xử lý xong (docs/rules/07). */
  level: 'NEEDS_ATTENTION' | 'STABLE';
  /** Đã có cảnh báo được Cố vấn học tập xử lý xong trong học kỳ. */
  resolved: boolean;
  /** Các điểm cần chú ý (đã xác nhận, chưa xử lý xong) — không có số điểm rủi ro thô. */
  focus: { source: SignalSource; course: string; detail: string; suggestion: string }[];
  advisor: { fullName: string; email: string } | null;
}

/** Trang "Tình hình học tập của bạn" — gọi SAU assertScope (sinh viên chỉ xem chính mình). */
export async function getStudentOverview(
  studentId: string,
  termId: string,
): Promise<StudentOverviewDto | null> {
  const profile = await getStudentProfile(studentId, termId);
  if (!profile) return null;
  const ds = await getDataSource();
  const [alert, student] = await Promise.all([
    ds.getRepository(Alert).findOne({
      where: { studentId, termId, status: In([...STUDENT_VISIBLE_STATUSES]) },
    }),
    ds.getRepository(Student).findOne({
      where: { studentId },
      relations: { administrativeClass: true },
    }),
  ]);
  const active = alert && alert.status !== AlertStatus.RESOLVED ? alert : null;
  const triggers = active
    ? ((await loadCurrentTriggers(ds.manager, [active])).get(active.alertId) ?? [])
    : [];
  const courseName = new Map(profile.courses.map((c) => [c.courseId, c.courseName]));
  const advisorId = student?.administrativeClass?.advisorId;
  const advisor = advisorId
    ? await ds.getRepository(User).findOne({
        select: { fullName: true, email: true },
        where: { userId: advisorId },
      })
    : null;
  return {
    profile,
    level:
      active && SEVERITY_ORDER.indexOf(active.severity) >= SEVERITY_ORDER.indexOf(Severity.MEDIUM)
        ? 'NEEDS_ATTENTION'
        : 'STABLE',
    resolved: alert?.status === AlertStatus.RESOLVED,
    focus: triggers.map((t) => ({
      source: sourceOf(t.ruleCode),
      course: courseName.get(t.scopeId) ?? 'Cả học kỳ',
      detail: t.reason,
      suggestion: STUDENT_SUGGESTIONS[sourceOf(t.ruleCode)],
    })),
    advisor: advisor ? { fullName: advisor.fullName, email: advisor.email } : null,
  };
}

/** Sinh viên các lớp do Cố vấn học tập phụ trách + cảnh báo học kỳ (nếu có). */
export async function listAdvisorStudents(
  advisorId: string,
  termId: string,
): Promise<
  {
    studentId: string;
    fullName: string;
    classId: string;
    severity: Severity | null;
    status: AlertStatus | null;
  }[]
> {
  const ds = await getDataSource();
  const students = await ds
    .getRepository(Student)
    .createQueryBuilder('s')
    .innerJoin('s.administrativeClass', 'c')
    .where('c.advisorId = :advisorId', { advisorId })
    .orderBy('s.classId')
    .addOrderBy('s.studentId')
    .getMany();
  const alerts = await ds.getRepository(Alert).find({
    where: {
      termId,
      studentId: In(students.map((s) => s.studentId)),
      status: Not(AlertStatus.INVALIDATED),
    },
  });
  const alertOf = new Map(alerts.map((a) => [a.studentId, a]));
  return students.map((s) => ({
    studentId: s.studentId,
    fullName: s.fullName,
    classId: s.classId,
    severity: alertOf.get(s.studentId)?.severity ?? null,
    status: alertOf.get(s.studentId)?.status ?? null,
  }));
}
