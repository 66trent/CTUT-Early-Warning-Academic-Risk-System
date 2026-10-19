import { describe, expect, it } from 'vitest';
import { DataCompletenessLevel, DataStatus, LmsActivityType, QuizAttemptStatus } from '@/db/enums';
import { DEFAULT_RISK_SCORE_CONFIG } from '@/modules/rule-engine/evaluator/config';
import { evaluateStudent } from '@/modules/rule-engine/evaluator/engine';
import {
  buildLmsGroups,
  type LmsActivityInfo,
  type LmsGroupMember,
  NO_LMS,
} from '@/modules/rule-engine/evaluator/lms-groups';
import {
  AS_OF,
  attempt,
  completed,
  context,
  enrollment,
  previousTerm,
  result,
  snapshot,
  student,
  submission,
  termResult,
  vn,
} from '../../helpers/evaluator-fixtures';

const riskOf = (
  enrollments: ReturnType<typeof enrollment>[],
  over: Parameters<typeof student>[1] = {},
) => evaluateStudent(student(enrollments, over), context()).riskScore;

describe('Chính sách dữ liệu thiếu — FULL / PARTIAL / INSUFFICIENT', () => {
  it('thiếu 0/3 nhóm → FULL (học lực lấy ĐTB học kỳ trước khi kỳ này chưa có kết quả)', () => {
    const risk = riskOf([enrollment()], { previousTerm: previousTerm([termResult('P', 'B')]) });
    expect(risk.level).toBe(DataCompletenessLevel.FULL);
    expect(risk.components.find((c) => c.group === 'ACADEMIC')).toMatchObject({
      rawValue: 3,
      normalized: 0,
      basis: 'PREVIOUS_TERM',
    });
  });

  it('thiếu 1/3 nhóm (chưa có điểm nào) → PARTIAL, trọng số chia lại trên 2 nhóm còn lại', () => {
    const risk = riskOf([
      enrollment({ attendance: [snapshot('2025-10-09', { unexcusedAbsence: 9 })] }),
    ]);
    expect(risk.level).toBe(DataCompletenessLevel.PARTIAL);
    // điểm danh 9/45 = 0,2 → 1; LMS 0 bài bỏ → 0 → (0,4×1 + 0,3×0) / 0,7
    expect(risk.value).toBeCloseTo(0.4 / 0.7);
  });

  it('thiếu 2/3 nhóm (điểm danh quá hạn STALE, chưa có điểm) → PARTIAL, chỉ còn LMS', () => {
    const risk = riskOf([enrollment({ attendance: [snapshot('2025-09-01')] })]);
    expect(risk.level).toBe(DataCompletenessLevel.PARTIAL);
    expect(risk.components.map((c) => c.status)).toEqual([
      DataStatus.STALE,
      DataStatus.AVAILABLE,
      DataStatus.MISSING,
    ]);
    expect(risk.value).toBe(0);
  });

  it('thiếu 3/3 nhóm → INSUFFICIENT, điểm NULL (không hiển thị như "rủi ro thấp")', () => {
    const risk = riskOf([
      enrollment({ attendance: [], lms: NO_LMS, quizAttempts: [], submissions: [] }),
    ]);
    expect(risk).toMatchObject({ level: DataCompletenessLevel.INSUFFICIENT, value: null });
  });

  it('môn không dùng LMS (NOT_APPLICABLE) không bị tính là thiếu → vẫn FULL', () => {
    const risk = riskOf([enrollment({ lms: NO_LMS, quizAttempts: [], submissions: [] })], {
      previousTerm: previousTerm([termResult('P', 'C')]),
    });
    expect(risk.level).toBe(DataCompletenessLevel.FULL);
  });

  it('học lực ưu tiên ĐTB học kỳ này; chuẩn hóa (2,0 − ĐTB) / 2,0', () => {
    const risk = riskOf([completed('A', 'D'), completed('B', 'D')], {
      previousTerm: previousTerm([termResult('P', 'A')]),
    });
    expect(risk.components.find((c) => c.group === 'ACADEMIC')).toMatchObject({
      rawValue: 1,
      normalized: 0.5,
      basis: 'CURRENT_TERM',
    });
  });

  it('gộp nhiều học phần bằng cộng dồn số liệu (không trung bình từng học phần)', () => {
    const risk = riskOf([
      enrollment({
        courseId: 'C1',
        enrollmentId: 'E1',
        attendance: [snapshot('2025-10-09', { totalPeriods: 30, unexcusedAbsence: 6 })],
        lms: NO_LMS,
      }),
      enrollment({ courseId: 'C2', enrollmentId: 'E2', lms: NO_LMS }),
    ]);
    const attendance = risk.components.find((c) => c.group === 'ATTENDANCE');
    expect(attendance?.rawValue).toBeCloseTo(6 / 75);
  });
});

describe('Chống rò rỉ thời gian — kết quả tại asOf không đổi khi thêm dữ liệu sau asOf', () => {
  const base = () => [
    enrollment({
      attendance: [
        snapshot('2025-10-02', { unexcusedAbsence: 1 }),
        snapshot('2025-10-09', { unexcusedAbsence: 5 }),
      ],
    }),
  ];

  it('thêm snapshot, lượt làm bài, bài nộp, kết quả học phần phát sinh sau asOf → trigger và RiskScore giữ nguyên', () => {
    const before = evaluateStudent(student(base()), context());
    const [e] = base();
    const withFuture = {
      ...e,
      attendance: [...e.attendance, snapshot('2025-10-20', { unexcusedAbsence: 20 })],
      quizAttempts: [...e.quizAttempts, attempt('Q09', '2025-10-15', { score: 0 })],
      submissions: [...e.submissions, submission('TH09', vn('2025-10-15'))],
      result: result('F', { publishedAt: vn('2025-12-30') }),
    };
    const after = evaluateStudent(student([withFuture]), context());
    expect(after.triggers).toEqual(before.triggers);
    expect(after.riskScore).toEqual(before.riskScore);
  });
});

describe('Bài LMS đến hạn theo lớp học phần (lms-groups)', () => {
  const quiz = (id: string, section: string, dueAt: Date | null): LmsActivityInfo => ({
    activityId: id,
    activityType: LmsActivityType.QUIZ,
    name: `Bài ${id}`,
    sectionCode: section,
    dueAt,
  });
  const assignment = (id: string, section: string, dueAt: Date): LmsActivityInfo => ({
    activityId: id,
    activityType: LmsActivityType.ASSIGNMENT,
    name: `Thực hành ${id}`,
    sectionCode: section,
    dueAt,
  });
  const member = (
    id: string,
    section: string | null,
    quizDates: [string, string][] = [],
    submittedAt: [string, Date][] = [],
  ): LmsGroupMember => ({
    enrollmentId: id,
    withdrawn: false,
    sectionCode: section,
    attempts: quizDates.map(([activityId, d]) => ({
      activityId,
      startedAt: vn(d),
      status: QuizAttemptStatus.SUBMITTED,
    })),
    submissions: submittedAt.map(([activityId, at]) => ({ activityId, submittedAt: at })),
  });
  const params = DEFAULT_RISK_SCORE_CONFIG.lms;

  it('bài có hạn nộp: đến hạn khi hạn ≤ asOf, kể cả chưa ai làm; bài sau hạn chưa xét', () => {
    const activities = [quiz('Q1', '01', vn('2025-10-01')), quiz('Q2', '01', vn('2025-10-20'))];
    const ctx = buildLmsGroups(activities, [member('A', '01')], AS_OF, params).get('A');
    expect(ctx?.quizApplicable).toBe(true);
    expect(ctx?.dueQuizzes.map((q) => q.activityId)).toEqual(['Q1']);
  });

  it('bài không có hạn nộp (dự phòng): lượt làm sau asOf không làm bài thành "đến hạn"', () => {
    const activities = [quiz('Q', '01', null)];
    const members = [
      member('A', '01', [['Q', '2025-10-01']]),
      member('B', '01', [['Q', '2025-10-12']]),
      member('C', '01'),
    ];
    // asOf 10/10: chỉ A đã làm (1/3 < 50%) → chưa đến hạn, dù sau đó B làm.
    expect(buildLmsGroups(activities, members, AS_OF, params).get('C')?.dueQuizzes).toEqual([]);
    expect(
      buildLmsGroups(activities, members, vn('2025-10-20'), params).get('C')?.dueQuizzes,
    ).toHaveLength(1);
  });

  it('sinh viên chỉ bị xét bài của lớp học phần mình', () => {
    const activities = [
      quiz('Q1', '01', vn('2025-10-01')),
      quiz('Q2', '02', vn('2025-10-01')),
      assignment('T2', '02', vn('2025-10-01')),
    ];
    const groups = buildLmsGroups(
      activities,
      [member('A', '01'), member('B', '02')],
      AS_OF,
      params,
    );
    expect(groups.get('A')?.dueQuizzes.map((q) => q.activityId)).toEqual(['Q1']);
    expect(groups.get('A')?.assignmentApplicable).toBe(false);
    expect(groups.get('B')?.dueAssignments.map((a) => a.activityId)).toEqual(['T2']);
  });

  it('bài thực hành chưa đến hạn, chưa ai nộp → NOT_APPLICABLE; có người nộp sớm → AVAILABLE', () => {
    const activities = [assignment('T1', '01', vn('2025-10-14'))];
    expect(
      buildLmsGroups(activities, [member('A', '01')], AS_OF, params).get('A')?.assignmentApplicable,
    ).toBe(false);
    const early = member('B', '01', [], [['T1', vn('2025-10-08')]]);
    const ctx = buildLmsGroups(activities, [member('A', '01'), early], AS_OF, params).get('A');
    expect(ctx).toMatchObject({ assignmentApplicable: true, dueAssignments: [] });
  });
});
