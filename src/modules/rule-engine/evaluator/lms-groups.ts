import { LmsActivityType, QuizAttemptStatus } from '@/db/enums';
import { type RiskScoreConfig } from './config';
import { DAY_MS } from './helpers';
import { type DueAssignment, type DueQuiz, type LmsGroupContext } from './types';

/** 1 bài LMS của học phần × học kỳ (docs/rules/10). */
export interface LmsActivityInfo {
  activityId: string;
  activityType: LmsActivityType;
  name: string;
  sectionCode: string;
  dueAt: Date | null;
}

/** Dữ liệu LMS của 1 Enrollment trong học phần × học kỳ — đầu vào tính bài đến hạn. */
export interface LmsGroupMember {
  enrollmentId: string;
  withdrawn: boolean;
  /** Lớp học phần hiện tại (`Enrollment.sectionCode`); NULL → xét mọi bài của học phần. */
  sectionCode: string | null;
  attempts: { activityId: string; startedAt: Date; status: QuizAttemptStatus }[];
  submissions: { activityId: string; submittedAt: Date | null }[];
}

const inSection = (a: LmsActivityInfo, section: string | null) =>
  section === null || a.sectionCode === section;

/** Lượt làm đầu tiên của lớp cho mỗi bài và số sinh viên đã nộp (≤ asOf). */
function quizStats(members: readonly LmsGroupMember[], asOf: Date) {
  const stats = new Map<string, { firstStartedAt: Date; submitted: Set<string> }>();
  for (const member of members) {
    for (const a of member.attempts) {
      if (a.startedAt > asOf) continue;
      const stat = stats.get(a.activityId) ?? { firstStartedAt: a.startedAt, submitted: new Set() };
      if (a.startedAt < stat.firstStartedAt) stat.firstStartedAt = a.startedAt;
      if (a.status === QuizAttemptStatus.SUBMITTED) stat.submitted.add(member.enrollmentId);
      stats.set(a.activityId, stat);
    }
  }
  return stats;
}

/**
 * Bài trắc nghiệm đến hạn của 1 lớp học phần (docs/rules/08): có hạn nộp → `dueAt ≤ asOf`;
 * không có hạn → tỷ lệ sinh viên của lớp đã nộp ≥ `participationThreshold` VÀ đã qua `graceDays`
 * kể từ lượt làm đầu tiên của lớp. So sánh tỷ lệ bằng số nguyên phần nghìn.
 */
function dueQuizzes(
  quizzes: readonly LmsActivityInfo[],
  group: readonly LmsGroupMember[],
  asOf: Date,
  params: RiskScoreConfig['lms'],
): { known: boolean; due: DueQuiz[] } {
  const stats = quizStats(group, asOf);
  const threshold = Math.round(params.participationThreshold * 1000);
  let known = false;
  const due: DueQuiz[] = [];
  for (const q of quizzes) {
    const stat = stats.get(q.activityId);
    if ((q.dueAt && q.dueAt <= asOf) || stat) known = true;
    if (q.dueAt) {
      if (q.dueAt <= asOf)
        due.push({ activityId: q.activityId, quizName: q.name, orderAt: q.dueAt });
      continue;
    }
    if (
      stat &&
      stat.submitted.size * 1000 >= threshold * group.length &&
      asOf.getTime() - stat.firstStartedAt.getTime() >= params.graceDays * DAY_MS
    ) {
      due.push({ activityId: q.activityId, quizName: q.name, orderAt: stat.firstStartedAt });
    }
  }
  return { known, due: due.sort((a, b) => a.orderAt.getTime() - b.orderAt.getTime()) };
}

/** Bài thực hành: đến hạn khi `dueAt ≤ asOf`; "đã biết" khi có bài đến hạn hoặc có bài nộp. */
function assignmentContext(
  assignments: readonly LmsActivityInfo[],
  group: readonly LmsGroupMember[],
  asOf: Date,
) {
  const due: DueAssignment[] = assignments
    .filter((a): a is LmsActivityInfo & { dueAt: Date } => a.dueAt !== null && a.dueAt <= asOf)
    .map((a) => ({ activityId: a.activityId, name: a.name, dueAt: a.dueAt }))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const ids = new Set(assignments.map((a) => a.activityId));
  const anySubmitted = group.some((m) =>
    m.submissions.some((s) => ids.has(s.activityId) && s.submittedAt && s.submittedAt <= asOf),
  );
  const dueAt = new Map(
    assignments.filter((a) => a.dueAt).map((a) => [a.activityId, a.dueAt as Date]),
  );
  return { applicable: due.length > 0 || anySubmitted, due, dueAt };
}

/**
 * Bối cảnh LMS của mọi Enrollment trong 1 học phần × học kỳ tại asOf. Sinh viên chỉ bị xét bài
 * của lớp học phần mình; lớp = các Enrollment chưa rút cùng `sectionCode`. Hàm thuần.
 */
export function buildLmsGroups(
  activities: readonly LmsActivityInfo[],
  members: readonly LmsGroupMember[],
  asOf: Date,
  params: RiskScoreConfig['lms'],
): Map<string, LmsGroupContext> {
  const active = members.filter((m) => !m.withdrawn);
  const contexts = new Map<string, LmsGroupContext>();
  const bySection = new Map<string, LmsGroupContext>();
  for (const member of members) {
    const key = member.sectionCode ?? '';
    let ctx = bySection.get(key);
    if (!ctx) {
      const own = activities.filter((a) => inSection(a, member.sectionCode));
      const group = active.filter(
        (m) => member.sectionCode === null || m.sectionCode === member.sectionCode,
      );
      const quiz = dueQuizzes(
        own.filter((a) => a.activityType === LmsActivityType.QUIZ),
        group,
        asOf,
        params,
      );
      const assignment = assignmentContext(
        own.filter((a) => a.activityType === LmsActivityType.ASSIGNMENT),
        group,
        asOf,
      );
      ctx = {
        quizApplicable: quiz.known,
        dueQuizzes: quiz.due,
        assignmentApplicable: assignment.applicable,
        dueAssignments: assignment.due,
        assignmentDueAt: assignment.dueAt,
      };
      bySection.set(key, ctx);
    }
    contexts.set(member.enrollmentId, ctx);
  }
  return contexts;
}

/** Enrollment không có dữ liệu LMS nào. */
export const NO_LMS: LmsGroupContext = {
  quizApplicable: false,
  dueQuizzes: [],
  assignmentApplicable: false,
  dueAssignments: [],
  assignmentDueAt: new Map(),
};
