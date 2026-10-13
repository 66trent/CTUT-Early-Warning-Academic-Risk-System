import { In, Not } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import {
  AlertStatus,
  type CourseResultStatus,
  QuizAttemptStatus,
  Severity,
  SEVERITY_ORDER,
} from '@/db/enums';
import { type SignalSource, sourceOf, STUDENT_SUGGESTIONS } from './alert-presentation';

export interface CourseSnapshotDto {
  courseId: string;
  courseName: string;
  credits: number | null;
  attemptNumber: number;
  attendance: {
    snapshotDate: string;
    absences: number;
    denominator: number;
    late: number;
  } | null;
  quizzesSubmitted: number;
  quizzesAttempted: number;
  result: {
    status: CourseResultStatus;
    processScore: number | null;
    finalScore: number | null;
    letterGrade: string | null;
  } | null;
}

export interface StudentProfileDto {
  studentId: string;
  fullName: string;
  classId: string;
  termId: string;
  termName: string;
  courses: CourseSnapshotDto[];
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
  const [snapshots, attempts, results] = await Promise.all([
    ds.getRepository(AttendanceSummary).find({
      where: { enrollmentId: In(ids) },
      order: { snapshotDate: 'DESC' },
    }),
    ds.getRepository(LmsQuizAttempt).find({ where: { enrollmentId: In(ids) } }),
    ds.getRepository(CourseResult).find({ where: { enrollmentId: In(ids) } }),
  ]);
  return {
    studentId,
    fullName: student.fullName,
    classId: student.classId,
    termId,
    termName: term.termName,
    courses: enrollments.map((e) => {
      const latest = snapshots.find((s) => s.enrollmentId === e.enrollmentId);
      const mine = attempts.filter((a) => a.enrollmentId === e.enrollmentId);
      const r = results.find((x) => x.enrollmentId === e.enrollmentId);
      return {
        courseId: e.courseId,
        courseName: e.course?.courseName ?? e.courseId,
        credits: e.course?.credits ?? null,
        attemptNumber: e.attemptNumber,
        attendance: latest
          ? {
              snapshotDate: latest.snapshotDate.toISOString(),
              absences: latest.excusedAbsence + latest.unexcusedAbsence,
              denominator: latest.plannedSessions ?? latest.totalSessions,
              late: latest.late,
            }
          : null,
        quizzesSubmitted: new Set(
          mine.filter((a) => a.status === QuizAttemptStatus.SUBMITTED).map((a) => a.quizKey),
        ).size,
        quizzesAttempted: new Set(mine.map((a) => a.quizKey)).size,
        result: r
          ? {
              status: r.resultStatus,
              processScore: r.processScore,
              finalScore: r.finalScore,
              letterGrade: r.letterGrade,
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
    ? await ds.getRepository(RuleTrigger).find({
        where: { alertId: active.alertId, evaluationRunId: active.lastEvaluationRunId },
      })
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
