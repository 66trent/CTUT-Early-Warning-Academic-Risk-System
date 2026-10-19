import { QuizAttemptStatus, SubmissionStatus } from '@/db/enums';
import {
  DEFAULT_RISK_SCORE_CONFIG,
  type RiskScoreConfig,
} from '@/modules/rule-engine/evaluator/config';
import { type EvaluationContext, evaluateStudent } from '@/modules/rule-engine/evaluator/engine';
import { RULES } from '@/modules/rule-engine/evaluator/rules';
import {
  type ActiveRule,
  type AttendanceSnapshotInput,
  type CourseResultInput,
  type DueAssignment,
  type DueQuiz,
  type EnrollmentInput,
  type LmsGroupContext,
  type PreviousTermInput,
  type QuizAttemptInput,
  type StudentInput,
  type SubmissionInput,
  type TermResultInput,
} from '@/modules/rule-engine/evaluator/types';

/** Dữ liệu mẫu cho test evaluator (hàm thuần, không DB). Mốc mặc định: hết ngày 10/10/2025. */
export const AS_OF = new Date('2025-10-10T23:59:59+07:00');
export const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`);

/** Snapshot điểm danh (tiết) — học phần 45 tiết, không vắng. */
export function snapshot(
  date: string,
  over: Partial<AttendanceSnapshotInput> = {},
): AttendanceSnapshotInput {
  return {
    snapshotDate: vn(date),
    totalPeriods: 45,
    excusedAbsence: 0,
    unexcusedAbsence: 0,
    ...over,
  };
}

/** Q01–Q03 đã đến hạn (theo hạn nộp) của lớp học phần. */
export const DUE_QUIZZES: DueQuiz[] = ['Q01', 'Q02', 'Q03'].map((activityId, i) => ({
  activityId,
  quizName: `Bài ${activityId}`,
  orderAt: vn(`2025-09-${14 + i * 7}`, '23:59'),
}));

/** TH01–TH02 đã quá hạn. */
export const DUE_ASSIGNMENTS: DueAssignment[] = ['TH01', 'TH02'].map((activityId, i) => ({
  activityId,
  name: `Thực hành ${activityId}`,
  dueAt: vn(`2025-09-${20 + i * 7}`, '23:59'),
}));

export function attempt(
  activityId: string,
  date: string,
  over: Partial<QuizAttemptInput> = {},
): QuizAttemptInput {
  return {
    activityId,
    attemptNumber: 1,
    startedAt: vn(date, '08:00'),
    submittedAt: vn(date, '08:20'),
    score: 8,
    maxScore: 10,
    correctCount: 8,
    totalQuestions: 10,
    status: QuizAttemptStatus.SUBMITTED,
    ...over,
  };
}

/** Nộp bài thực hành; mặc định nộp 1 ngày trước hạn. */
export function submission(
  activityId: string,
  submittedAt: Date | null,
  status: SubmissionStatus = SubmissionStatus.ON_TIME,
): SubmissionInput {
  return { activityId, status, submittedAt };
}

const onTimeSubmissions = () =>
  DUE_ASSIGNMENTS.map((a) => submission(a.activityId, new Date(a.dueAt.getTime() - 86_400_000)));

export function lmsContext(over: Partial<LmsGroupContext> = {}): LmsGroupContext {
  return {
    quizApplicable: true,
    dueQuizzes: DUE_QUIZZES,
    assignmentApplicable: true,
    dueAssignments: DUE_ASSIGNMENTS,
    assignmentDueAt: new Map(DUE_ASSIGNMENTS.map((a) => [a.activityId, a.dueAt])),
    ...over,
  };
}

/** Kết quả học phần đã khóa điểm (mặc định công bố trước mốc AS_OF). */
export function result(
  letterGrade: string,
  over: Partial<CourseResultInput> = {},
): CourseResultInput {
  return {
    letterGrade,
    passed: letterGrade !== 'F',
    eligibleForExam: true,
    absentFromExam: false,
    publishedAt: vn('2025-10-05'),
    ...over,
  };
}

export function enrollment(over: Partial<EnrollmentInput> = {}): EnrollmentInput {
  return {
    enrollmentId: `E-${over.courseId ?? 'HP001'}`,
    courseId: 'HP001',
    courseName: 'Công nghệ phần mềm',
    credits: 3,
    withdrawn: false,
    attendance: [snapshot('2025-10-09')],
    quizAttempts: DUE_QUIZZES.map((q) =>
      attempt(q.activityId, q.orderAt.toISOString().slice(0, 10)),
    ),
    submissions: onTimeSubmissions(),
    result: null,
    priorAttempts: [],
    lms: lmsContext(),
    ...over,
  };
}

/** Học phần đã có kết quả, không còn dữ liệu đang học. */
export const completed = (
  courseId: string,
  letterGrade: string,
  credits = 3,
  over: Partial<EnrollmentInput> = {},
) =>
  enrollment({
    courseId,
    courseName: `Học phần ${courseId}`,
    credits,
    result: result(letterGrade),
    ...over,
  });

export function termResult(courseId: string, letterGrade: string, credits = 3): TermResultInput {
  return {
    courseId,
    courseName: `Học phần ${courseId}`,
    credits,
    letterGrade,
    passed: letterGrade !== 'F',
    publishedAt: vn('2025-06-10'),
  };
}

export function previousTerm(
  results: TermResultInput[],
  over: Partial<PreviousTermInput> = {},
): PreviousTermInput {
  return {
    termId: 'HK3_2024',
    termName: 'Học kỳ 3, 2024–2025',
    isFirstTerm: false,
    results,
    ...over,
  };
}

export function student(
  enrollments: EnrollmentInput[],
  over: Partial<StudentInput> = {},
): StudentInput {
  return {
    studentId: 'SV001',
    termId: 'HK1_2025',
    termName: 'Học kỳ 1, 2025–2026',
    isFirstTerm: false,
    enrollments,
    previousTerm: null,
    ...over,
  };
}

/** Mọi luật bật với ngưỡng mặc định; `overrides` thay condition của vài luật. */
export function context(
  overrides: Record<string, unknown> = {},
  config: RiskScoreConfig = DEFAULT_RISK_SCORE_CONFIG,
  asOf = AS_OF,
  extra: Partial<EvaluationContext> = {},
): EvaluationContext {
  const activeRules = new Map<string, ActiveRule>(
    RULES.map((r) => [
      r.meta.ruleCode,
      {
        ruleVersionId: `v-${r.meta.ruleCode}`,
        condition: overrides[r.meta.ruleCode] ?? r.defaultCondition,
      },
    ]),
  );
  return { asOf, activeRules, config, ...extra };
}

/** Trigger của 1 luật khi đánh giá sinh viên có các Enrollment cho trước. */
export function triggersOf(
  ruleCode: string,
  enrollments: EnrollmentInput[],
  ctx: EvaluationContext = context(),
  studentOver: Partial<StudentInput> = {},
) {
  return evaluateStudent(student(enrollments, studentOver), ctx).triggers.filter(
    (t) => t.ruleCode === ruleCode,
  );
}
