/**
 * Kiểu dữ liệu vào/ra của evaluator (docs/rules/08). Evaluator là hàm thuần: KHÔNG import
 * next/*, DataSource hay repository — nhận dữ liệu đã nạp sẵn, trả kết quả (docs/rules/01).
 */
import { type z } from 'zod';
import {
  type DataStatus,
  type QuizAttemptStatus,
  type RuleGroup,
  type RuleScope,
  type Severity,
  type SubmissionStatus,
} from '@/db/enums';
import { type RiskScoreConfig } from './config';

/** Snapshot điểm danh, đơn vị TIẾT. */
export interface AttendanceSnapshotInput {
  snapshotDate: Date;
  totalPeriods: number;
  excusedAbsence: number;
  unexcusedAbsence: number;
}

export interface QuizAttemptInput {
  activityId: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  status: QuizAttemptStatus;
}

export interface SubmissionInput {
  activityId: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
}

export interface CourseResultInput {
  letterGrade: string;
  passed: boolean;
  eligibleForExam: boolean | null;
  absentFromExam: boolean | null;
  publishedAt: Date;
}

/** Lần học cùng học phần ở học kỳ TRƯỚC (theo `Term.startDate`) — để tính lần học theo asOf. */
export interface PriorAttemptInput {
  termId: string;
  termName: string;
  result: Pick<CourseResultInput, 'passed' | 'publishedAt'> | null;
}

/** Bài trắc nghiệm đã đến hạn của lớp học phần. */
export interface DueQuiz {
  activityId: string;
  quizName: string;
  /** Hạn nộp, hoặc lượt làm đầu tiên của lớp khi bài không có hạn — để sắp "bài gần nhất". */
  orderAt: Date;
}

/** Bài thực hành đã đến hạn của lớp học phần. */
export interface DueAssignment {
  activityId: string;
  name: string;
  dueAt: Date;
}

/** Bối cảnh LMS của 1 Enrollment tại asOf (xem `lms-groups.ts`). */
export interface LmsGroupContext {
  /** false = lớp học phần chưa có bài trắc nghiệm nào đã biết tại asOf → `NOT_APPLICABLE`. */
  quizApplicable: boolean;
  dueQuizzes: DueQuiz[];
  /** false = chưa có bài thực hành nào đến hạn / có bài nộp tại asOf → `NOT_APPLICABLE`. */
  assignmentApplicable: boolean;
  dueAssignments: DueAssignment[];
  /** Hạn nộp của mọi bài thực hành của lớp (để biết nộp trễ). */
  assignmentDueAt: ReadonlyMap<string, Date>;
}

export interface EnrollmentInput {
  enrollmentId: string;
  courseId: string;
  courseName: string;
  credits: number | null;
  /** Admin đánh dấu rút học phần (trạng thái hiện tại — đánh dấu tay). */
  withdrawn: boolean;
  attendance: AttendanceSnapshotInput[];
  quizAttempts: QuizAttemptInput[];
  submissions: SubmissionInput[];
  result: CourseResultInput | null;
  priorAttempts: PriorAttemptInput[];
  lms: LmsGroupContext;
}

/** 1 kết quả học phần của học kỳ (dùng cho ĐTB / tín chỉ không đạt). */
export interface TermResultInput {
  courseId: string;
  courseName: string;
  credits: number | null;
  letterGrade: string;
  passed: boolean;
  publishedAt: Date;
}

/** Học kỳ liền trước của sinh viên (ACA-04, RiskScore học lực) — chỉ kết quả học phần. */
export interface PreviousTermInput {
  termId: string;
  termName: string;
  isFirstTerm: boolean;
  results: TermResultInput[];
}

export interface StudentInput {
  studentId: string;
  termId: string;
  termName: string;
  /** Học kỳ đang tính là học kỳ đầu khóa của lớp sinh hoạt (ngưỡng ĐTB 0,8 — docs/rules/08). */
  isFirstTerm: boolean;
  enrollments: EnrollmentInput[];
  previousTerm: PreviousTermInput | null;
}

/** Trạng thái Enrollment TẠI asOf (không đọc trạng thái hiện tại trong DB — docs/rules/08). */
export type EnrollmentState = 'REGISTERED' | 'COMPLETED' | 'WITHDRAWN';

/** Dữ kiện đã chuẩn bị cho 1 Enrollment sau bước 1–4. */
export interface EnrollmentFacts {
  input: EnrollmentInput;
  state: EnrollmentState;
  attemptNumber: number;
  failedTerms: { termId: string; termName: string }[];
  attendance: {
    status: DataStatus;
    latest: AttendanceSnapshotInput | null;
    previous: AttendanceSnapshotInput | null;
  };
  quiz: { status: DataStatus; dueQuizzes: DueQuiz[]; attempts: QuizAttemptInput[] };
  assignment: {
    status: DataStatus;
    dueAssignments: DueAssignment[];
    /** Bài đã nộp tại asOf (`submittedAt ≤ asOf`) → thời điểm nộp. */
    submittedAt: ReadonlyMap<string, Date>;
    dueAt: ReadonlyMap<string, Date>;
  };
  result: CourseResultInput | null;
}

export interface DataWarning {
  code: string;
  courseId?: string;
  message: string;
}

export type SnapshotValue = string | number | boolean | null;

export interface RuleHit {
  severity: Severity;
  reason: string;
  inputSnapshot: Record<string, SnapshotValue>;
}

export interface RuleOutcome {
  hit: RuleHit | null;
  warnings?: DataWarning[];
}

/** Nguồn tín hiệu của 1 luật — COMB-01 đếm số nguồn khác nhau (docs/rules/08). */
export type SignalSource = 'ATTENDANCE' | 'QUIZ' | 'ASSIGNMENT' | 'ACADEMIC';

export interface RuleMeta {
  ruleCode: string;
  ruleName: string;
  ruleGroup: RuleGroup;
  scope: RuleScope;
  priority: number;
  signal: SignalSource | null;
  /** Nhóm dữ liệu phải AVAILABLE thì luật mới chạy (ngoại lệ bước 3). */
  requires: 'ATTENDANCE' | 'LMS_QUIZ' | 'LMS_ASSIGNMENT' | null;
}

interface RuleBase<C> {
  meta: RuleMeta;
  conditionSchema: z.ZodType<C>;
  defaultCondition: C;
  /** Mức cao nhất luật có thể ra với `condition` — ghi vào `RuleVersion.severity`. */
  maxSeverity(condition: C): Severity;
}

export interface PriorHit {
  ruleCode: string;
  ruleGroup: RuleGroup;
  signal: SignalSource | null;
  severity: Severity;
}

export interface CourseRuleContext {
  facts: EnrollmentFacts;
  asOf: Date;
  /** Trigger của các luật BASE vừa chạy trên CÙNG Enrollment (cho COMB-*). */
  priorHits: PriorHit[];
}

export interface CourseRule<C> extends RuleBase<C> {
  kind: 'PER_COURSE';
  /** COMBINED chạy sau cùng, trên kết quả các luật BASE (bước 6). */
  stage: 'BASE' | 'COMBINED';
  /** Trạng thái Enrollment luật xét: đang học (`REGISTERED`) hay đã có kết quả (`COMPLETED`). */
  appliesTo: 'REGISTERED' | 'COMPLETED';
  evaluate(ctx: CourseRuleContext, condition: C): RuleOutcome;
}

export interface StudentRuleContext {
  /** Học phần của học kỳ đang tính, trừ WITHDRAWN. */
  facts: readonly EnrollmentFacts[];
  isFirstTerm: boolean;
  /** Số học phần chưa có kết quả (chỉ khác 0 ở lần chạy chốt học kỳ). */
  missingResults: number;
  previousTerm: PreviousTermInput | null;
  config: RiskScoreConfig;
  /** `condition` ACTIVE của luật khác (ACA-04 tính lại mức ACA-02/03 ở học kỳ trước). */
  conditionOf(ruleCode: string): unknown;
}

export interface StudentRule<C> extends RuleBase<C> {
  kind: 'PER_STUDENT';
  evaluate(ctx: StudentRuleContext, condition: C): RuleOutcome;
}

export type RuleDefinition<C = unknown> = CourseRule<C> | StudentRule<C>;

/** Phiên bản ACTIVE đã nạp + condition đã parse của 1 luật. */
export interface ActiveRule {
  ruleVersionId: string;
  condition: unknown;
}

export interface TriggerOutput extends RuleHit {
  ruleCode: string;
  ruleVersionId: string;
  scopeId: string;
}
