import { QuizAttemptStatus } from '@/db/enums';
import { type RiskScoreConfig } from './config';
import { DAY_MS } from './helpers';
import { type DueQuiz, type LmsGroupContext } from './types';

/** Dữ liệu LMS của 1 Enrollment trong học phần × học kỳ — đầu vào tính nhóm. */
export interface LmsGroupMember {
  enrollmentId: string;
  withdrawn: boolean;
  /** `sectionCode` của snapshot điểm danh mới nhất (≤ asOf) — dùng khi không có lượt LMS. */
  attendanceSection: string | null;
  attempts: {
    quizKey: string;
    quizName: string;
    startedAt: Date;
    status: QuizAttemptStatus;
    sectionCode: string | null;
  }[];
}

interface QuizStat {
  quizName: string;
  firstStartedAt: Date;
  submitted: Set<string>;
}

/**
 * "Bài đến hạn" của 1 học phần × học kỳ (docs/rules/08): bài Q đến hạn khi tỷ lệ sinh viên của
 * nhóm đã nộp ≥ `participationThreshold` VÀ `asOf −` lượt làm đầu tiên của nhóm ≥ `graceDays`.
 * Tách nhóm theo `sectionCode` khi MỌI lượt làm bài có `sectionCode`; sinh viên không có lượt
 * nào lấy `sectionCode` từ điểm danh (không bỏ sót sinh viên bỏ mọi bài). Hàm thuần.
 */
export function buildLmsGroups(
  members: readonly LmsGroupMember[],
  asOf: Date,
  params: RiskScoreConfig['lms'],
): Map<string, LmsGroupContext> {
  const visible = members.map((m) => ({
    ...m,
    attempts: m.attempts.filter((a) => a.startedAt <= asOf),
  }));
  const allAttempts = visible.flatMap((m) => m.attempts);
  const applicable = allAttempts.length > 0;
  const split = applicable && allAttempts.every((a) => a.sectionCode);
  const groupOf = (m: (typeof visible)[number]) =>
    split ? (m.attempts[0]?.sectionCode ?? m.attendanceSection ?? '') : '';

  const groups = new Map<string, typeof visible>();
  for (const member of visible) {
    if (member.withdrawn) continue;
    const key = groupOf(member);
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }

  const dueByGroup = new Map<string, DueQuiz[]>();
  for (const [key, group] of groups) {
    const stats = new Map<string, QuizStat>();
    for (const member of group) {
      for (const attempt of member.attempts) {
        const stat = stats.get(attempt.quizKey) ?? {
          quizName: attempt.quizName,
          firstStartedAt: attempt.startedAt,
          submitted: new Set<string>(),
        };
        if (attempt.startedAt < stat.firstStartedAt) stat.firstStartedAt = attempt.startedAt;
        if (attempt.status === QuizAttemptStatus.SUBMITTED) stat.submitted.add(member.enrollmentId);
        stats.set(attempt.quizKey, stat);
      }
    }
    const due = [...stats]
      .filter(
        ([, s]) =>
          // So sánh theo số nguyên phần nghìn để ca đúng ngưỡng ổn định.
          s.submitted.size * 1000 >=
            Math.round(params.participationThreshold * 1000) * group.length &&
          asOf.getTime() - s.firstStartedAt.getTime() >= params.graceDays * DAY_MS,
      )
      .map(([quizKey, s]) => ({ quizKey, quizName: s.quizName, firstStartedAt: s.firstStartedAt }))
      .sort((a, b) => a.firstStartedAt.getTime() - b.firstStartedAt.getTime());
    dueByGroup.set(key, due);
  }

  return new Map(
    visible.map((m) => {
      const key = groupOf(m);
      return [
        m.enrollmentId,
        {
          applicable,
          groupKey: key,
          groupSize: groups.get(key)?.length ?? 0,
          dueQuizzes: dueByGroup.get(key) ?? [],
        },
      ];
    }),
  );
}
