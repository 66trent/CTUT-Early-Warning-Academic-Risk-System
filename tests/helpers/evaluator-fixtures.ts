import { CourseResultStatus, QuizAttemptStatus } from '@/db/enums';
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
  type EnrollmentInput,
  type QuizAttemptInput,
  type StudentInput,
} from '@/modules/rule-engine/evaluator/types';

/** Dữ liệu mẫu cho test evaluator (hàm thuần, không DB). Mốc mặc định: hết ngày 10/10/2026. */
export const AS_OF = new Date('2026-10-10T23:59:59+07:00');
export const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`);

export function snapshot(
  date: string,
  over: Partial<AttendanceSnapshotInput> = {},
): AttendanceSnapshotInput {
  return {
    snapshotDate: vn(date),
    totalSessions: 16,
    plannedSessions: 30,
    present: 16,
    late: 0,
    excusedAbsence: 0,
    unexcusedAbsence: 0,
    sectionCode: null,
    ...over,
  };
}

export function attempt(
  quizKey: string,
  date: string,
  over: Partial<QuizAttemptInput> = {},
): QuizAttemptInput {
  return {
    quizKey,
    quizName: `Bài ${quizKey}`,
    attemptNumber: 1,
    startedAt: vn(date, '08:00'),
    submittedAt: vn(date, '08:20'),
    score: 8,
    maxScore: 10,
    status: QuizAttemptStatus.SUBMITTED,
    ...over,
  };
}

export function result(over: Partial<CourseResultInput> = {}): CourseResultInput {
  return {
    processScore: 7,
    finalScore: null,
    letterGrade: null,
    passed: null,
    resultStatus: CourseResultStatus.PROCESS_ONLY,
    publishedAt: vn('2026-10-05'),
    processPublishedAt: vn('2026-10-05'),
    ...over,
  };
}

export const finalResult = (letterGrade: string, passed: boolean, finalScore = 6) =>
  result({
    finalScore,
    letterGrade,
    passed,
    resultStatus: CourseResultStatus.FINAL,
    publishedAt: vn('2026-06-10'),
    processPublishedAt: null,
  });

/** Q01–Q03 đã đến hạn của nhóm (mặc định). */
export const DUE = ['Q01', 'Q02', 'Q03'].map((quizKey, i) => ({
  quizKey,
  quizName: `Bài ${quizKey}`,
  firstStartedAt: vn(`2026-09-${14 + i * 7}`, '08:00'),
}));

export function enrollment(over: Partial<EnrollmentInput> = {}): EnrollmentInput {
  return {
    enrollmentId: `E-${over.courseId ?? 'KTPM201'}`,
    courseId: 'KTPM201',
    courseName: 'Công nghệ phần mềm',
    credits: 3,
    withdrawn: false,
    attendance: [snapshot('2026-10-09')],
    quizAttempts: DUE.map((q) => attempt(q.quizKey, q.firstStartedAt.toISOString().slice(0, 10))),
    result: null,
    priorAttempts: [],
    lmsGroup: { applicable: true, groupKey: '', groupSize: 10, dueQuizzes: DUE },
    ...over,
  };
}

export function student(enrollments: EnrollmentInput[]): StudentInput {
  return { studentId: 'SV001', termId: 'HK1_2026', termName: 'Học kỳ 1, 2026–2027', enrollments };
}

/** Mọi luật bật với ngưỡng mặc định; `overrides` thay condition của vài luật. */
export function context(
  overrides: Record<string, unknown> = {},
  config: RiskScoreConfig = DEFAULT_RISK_SCORE_CONFIG,
  asOf = AS_OF,
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
  return { asOf, activeRules, config };
}

/** Trigger của 1 luật khi đánh giá sinh viên có các Enrollment cho trước. */
export function triggersOf(
  ruleCode: string,
  enrollments: EnrollmentInput[],
  ctx: EvaluationContext = context(),
) {
  return evaluateStudent(student(enrollments), ctx).triggers.filter((t) => t.ruleCode === ruleCode);
}
