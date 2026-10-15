import { describe, expect, it } from 'vitest';
import { DataCompletenessLevel, DataStatus, QuizAttemptStatus } from '@/db/enums';
import { DEFAULT_RISK_SCORE_CONFIG } from '@/modules/rule-engine/evaluator/config';
import { evaluateStudent } from '@/modules/rule-engine/evaluator/engine';
import { buildLmsGroups, type LmsGroupMember } from '@/modules/rule-engine/evaluator/lms-groups';
import {
  AS_OF,
  attempt,
  context,
  enrollment,
  finalResult,
  result,
  snapshot,
  student,
  vn,
} from '../../helpers/evaluator-fixtures';

const NO_LMS = { applicable: false, groupKey: '', groupSize: 0, dueQuizzes: [] };
const riskOf = (enrollments: ReturnType<typeof enrollment>[]) =>
  evaluateStudent(student(enrollments), context()).riskScore;

describe('Chính sách dữ liệu thiếu — FULL / PARTIAL / INSUFFICIENT', () => {
  it('thiếu 0/3 nhóm → FULL', () => {
    expect(riskOf([enrollment({ result: result() })]).level).toBe(DataCompletenessLevel.FULL);
  });

  it('thiếu 1/3 nhóm (chưa có điểm) → PARTIAL, trọng số chia lại trên 2 nhóm còn lại', () => {
    const risk = riskOf([
      enrollment({ attendance: [snapshot('2026-10-09', { present: 13, unexcusedAbsence: 3 })] }),
    ]);
    expect(risk.level).toBe(DataCompletenessLevel.PARTIAL);
    // điểm danh 3/30 = 0,1 → 0,5; LMS 0 bài bỏ → 0 → (0,4×0,5 + 0,3×0) / 0,7
    expect(risk.value).toBeCloseTo((0.4 * 0.5) / 0.7);
  });

  it('thiếu 2/3 nhóm (điểm danh quá hạn STALE, chưa có điểm) → PARTIAL, chỉ còn LMS', () => {
    const risk = riskOf([enrollment({ attendance: [snapshot('2026-09-01')] })]);
    expect(risk.level).toBe(DataCompletenessLevel.PARTIAL);
    expect(risk.components.map((c) => c.status)).toEqual([
      DataStatus.STALE,
      DataStatus.AVAILABLE,
      DataStatus.MISSING,
    ]);
    expect(risk.value).toBe(0);
  });

  it('thiếu 3/3 nhóm → INSUFFICIENT, điểm NULL (không hiển thị như "rủi ro thấp")', () => {
    const risk = riskOf([enrollment({ attendance: [], lmsGroup: NO_LMS, quizAttempts: [] })]);
    expect(risk).toMatchObject({ level: DataCompletenessLevel.INSUFFICIENT, value: null });
  });

  it('môn không dùng LMS (NOT_APPLICABLE) không bị tính là thiếu → vẫn FULL', () => {
    const risk = riskOf([enrollment({ lmsGroup: NO_LMS, quizAttempts: [], result: result() })]);
    expect(risk.level).toBe(DataCompletenessLevel.FULL);
  });

  it('gộp nhiều học phần bằng cộng dồn số liệu (không trung bình từng học phần)', () => {
    const risk = riskOf([
      enrollment({
        courseId: 'C1',
        enrollmentId: 'E1',
        attendance: [snapshot('2026-10-09', { present: 10, unexcusedAbsence: 6 })],
        lmsGroup: NO_LMS,
      }),
      enrollment({
        courseId: 'C2',
        enrollmentId: 'E2',
        attendance: [snapshot('2026-10-09', { plannedSessions: 15 })],
        lmsGroup: NO_LMS,
      }),
    ]);
    const attendance = risk.components.find((c) => c.group === 'ATTENDANCE');
    expect(attendance?.rawValue).toBeCloseTo(6 / 45);
  });
});

describe('Chống rò rỉ thời gian — kết quả tại asOf không đổi khi thêm dữ liệu sau asOf', () => {
  const base = () => [
    enrollment({
      attendance: [
        snapshot('2026-10-02', { totalSessions: 14, present: 13, unexcusedAbsence: 1 }),
        snapshot('2026-10-09', { present: 13, unexcusedAbsence: 3 }),
      ],
      result: result({ processScore: 4.5 }),
    }),
  ];

  it('thêm snapshot, lượt làm bài, kết quả cuối kỳ phát sinh sau asOf → trigger và RiskScore giữ nguyên', () => {
    const before = evaluateStudent(student(base()), context());
    const [e] = base();
    const withFuture = {
      ...e,
      attendance: [
        ...e.attendance,
        snapshot('2026-10-20', { totalSessions: 18, present: 8, unexcusedAbsence: 10 }),
      ],
      quizAttempts: [...e.quizAttempts, attempt('Q09', '2026-10-15', { score: 0 })],
      result: {
        ...finalResult('F', false, 2),
        processScore: 4.5,
        publishedAt: vn('2026-12-30'),
        // Giữ lại từ lần nạp điểm giữa kỳ (dòng FINAL ghi đè dòng giữa kỳ).
        processPublishedAt: vn('2026-10-05'),
      },
    };
    const after = evaluateStudent(student([withFuture]), context());
    expect(after.triggers).toEqual(before.triggers);
    expect(after.riskScore).toEqual(before.riskScore);
  });

  it('nhóm LMS: lượt làm bài sau asOf không làm bài thành "đến hạn"', () => {
    const member = (id: string, dates: string[]): LmsGroupMember => ({
      enrollmentId: id,
      withdrawn: false,
      attendanceSection: null,
      attempts: dates.map((d) => ({
        quizKey: 'Q',
        quizName: 'Q',
        startedAt: vn(d),
        status: QuizAttemptStatus.SUBMITTED,
        sectionCode: null,
      })),
    });
    const members = [member('A', ['2026-10-01']), member('B', ['2026-10-12']), member('C', [])];
    // asOf 10/10: chỉ A đã làm (1/3 < 50%) → chưa đến hạn, dù sau đó B làm.
    expect(
      buildLmsGroups(members, AS_OF, DEFAULT_RISK_SCORE_CONFIG.lms).get('C')?.dueQuizzes,
    ).toEqual([]);
    expect(
      buildLmsGroups(members, vn('2026-10-20'), DEFAULT_RISK_SCORE_CONFIG.lms).get('C')?.dueQuizzes,
    ).toHaveLength(1);
  });
});

describe('Nhóm LMS theo lớp học phần', () => {
  const member = (
    id: string,
    section: string | null,
    attended: string | null,
    quiz?: string,
  ): LmsGroupMember => ({
    enrollmentId: id,
    withdrawn: false,
    attendanceSection: attended,
    attempts: quiz
      ? [
          {
            quizKey: quiz,
            quizName: quiz,
            startedAt: vn('2026-09-14'),
            status: QuizAttemptStatus.SUBMITTED,
            sectionCode: section,
          },
        ]
      : [],
  });

  it('mọi lượt có mã lớp → tách nhóm; sinh viên không làm bài nào lấy mã lớp từ điểm danh', () => {
    const groups = buildLmsGroups(
      [
        member('A', '01', '01', 'Q1'),
        member('B', '01', '01', 'Q1'),
        member('C', null, '01'),
        member('D', '02', '02', 'Q2'),
        member('E', null, '02'),
      ],
      AS_OF,
      DEFAULT_RISK_SCORE_CONFIG.lms,
    );
    expect(groups.get('C')).toMatchObject({ groupKey: '01', groupSize: 3 });
    expect(groups.get('C')?.dueQuizzes.map((q) => q.quizKey)).toEqual(['Q1']);
    expect(groups.get('E')?.dueQuizzes.map((q) => q.quizKey)).toEqual(['Q2']);
  });

  it('có lượt thiếu mã lớp → 1 nhóm chung; chưa có lượt nào → NOT_APPLICABLE', () => {
    const groups = buildLmsGroups(
      [member('A', null, '01', 'Q1'), member('B', '02', '02', 'Q1')],
      AS_OF,
      DEFAULT_RISK_SCORE_CONFIG.lms,
    );
    expect(groups.get('A')).toMatchObject({ groupKey: '', groupSize: 2 });
    expect(
      buildLmsGroups([member('A', null, null)], AS_OF, DEFAULT_RISK_SCORE_CONFIG.lms).get('A')
        ?.applicable,
    ).toBe(false);
  });
});
