/**
 * Kiểu dữ liệu vào/ra của evaluator (docs/rules/08). Evaluator là hàm thuần: KHÔNG import
 * next/*, DataSource hay repository — nhận dữ liệu đã nạp sẵn, trả kết quả (docs/rules/01).
 */
import { type z } from 'zod';
import {
  type CourseResultStatus,
  type DataStatus,
  type QuizAttemptStatus,
  type RuleGroup,
  type RuleScope,
  type Severity,
} from '@/db/enums';

export interface AttendanceSnapshotInput {
  snapshotDate: Date;
  totalSessions: number;
  plannedSessions: number | null;
  present: number;
  late: number;
  excusedAbsence: number;
  unexcusedAbsence: number;
  sectionCode: string | null;
}

export interface QuizAttemptInput {
  quizKey: string;
  quizName: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  status: QuizAttemptStatus;
}

export interface CourseResultInput {
  processScore: number | null;
  finalScore: number | null;
  letterGrade: string | null;
  passed: boolean | null;
  resultStatus: CourseResultStatus;
  publishedAt: Date;
  /** Ngày công bố điểm quá trình (giữ lại khi đã FINAL) — xem `asOfResult()`. */
  processPublishedAt: Date | null;
}

/** Lần học cùng học phần ở học kỳ TRƯỚC (theo `Term.startDate`) — để tính lần học theo asOf. */
export interface PriorAttemptInput {
  termId: string;
  termName: string;
  result: Pick<CourseResultInput, 'resultStatus' | 'passed' | 'publishedAt'> | null;
}

/** Bài kiểm tra đã đến hạn của nhóm (học phần × học kỳ × lớp học phần). */
export interface DueQuiz {
  quizKey: string;
  quizName: string;
  /** Lượt làm đầu tiên của cả nhóm — dùng để sắp "bài gần nhất". */
  firstStartedAt: Date;
}

/** Kết quả tính nhóm LMS cho 1 Enrollment (xem `lms-groups.ts`). */
export interface LmsGroupContext {
  /** false = học phần × học kỳ chưa có bài kiểm tra nào → LMS `NOT_APPLICABLE`. */
  applicable: boolean;
  groupKey: string;
  groupSize: number;
  dueQuizzes: DueQuiz[];
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
  result: CourseResultInput | null;
  priorAttempts: PriorAttemptInput[];
  lmsGroup: LmsGroupContext;
}

export interface StudentInput {
  studentId: string;
  termId: string;
  termName: string;
  enrollments: EnrollmentInput[];
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
  lms: { status: DataStatus; dueQuizzes: DueQuiz[]; attempts: QuizAttemptInput[] };
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

export interface RuleMeta {
  ruleCode: string;
  ruleName: string;
  ruleGroup: RuleGroup;
  scope: RuleScope;
  priority: number;
  /** Nhóm dữ liệu phải AVAILABLE thì luật mới chạy (ngoại lệ bước 3). */
  requires: 'ATTENDANCE' | 'LMS' | null;
}

interface RuleBase<C> {
  meta: RuleMeta;
  conditionSchema: z.ZodType<C>;
  defaultCondition: C;
  /** Mức cao nhất luật có thể ra với `condition` — ghi vào `RuleVersion.severity`. */
  maxSeverity(condition: C): Severity;
}

export interface CourseRuleContext {
  facts: EnrollmentFacts;
  asOf: Date;
  /** Trigger của các luật BASE vừa chạy trên CÙNG Enrollment (cho COMB-*). */
  priorHits: { ruleCode: string; ruleGroup: RuleGroup; severity: Severity }[];
}

export interface CourseRule<C> extends RuleBase<C> {
  kind: 'PER_COURSE';
  /** COMBINED chạy sau cùng, trên kết quả các luật BASE (bước 6). */
  stage: 'BASE' | 'COMBINED';
  evaluate(ctx: CourseRuleContext, condition: C): RuleOutcome;
}

export interface StudentRule<C> extends RuleBase<C> {
  kind: 'PER_STUDENT';
  evaluate(facts: readonly EnrollmentFacts[], condition: C): RuleOutcome;
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
