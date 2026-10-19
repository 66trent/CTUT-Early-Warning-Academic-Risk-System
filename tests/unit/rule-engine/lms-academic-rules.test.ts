import { describe, expect, it } from 'vitest';
import { QuizAttemptStatus, Severity, SubmissionStatus } from '@/db/enums';
import { DEFAULT_RISK_SCORE_CONFIG } from '@/modules/rule-engine/evaluator/config';
import { evaluateStudent } from '@/modules/rule-engine/evaluator/engine';
import {
  AS_OF,
  attempt,
  completed,
  context,
  DUE_ASSIGNMENTS,
  DUE_QUIZZES,
  enrollment,
  lmsContext,
  previousTerm,
  result,
  student,
  submission,
  termResult,
  triggersOf,
  vn,
} from '../../helpers/evaluator-fixtures';

const submittedOnly = (...ids: string[]) =>
  enrollment({
    quizAttempts: DUE_QUIZZES.filter((q) => ids.includes(q.activityId)).map((q) =>
      attempt(q.activityId, q.orderAt.toISOString().slice(0, 10)),
    ),
  });

describe('LMS-01: bỏ bài trắc nghiệm', () => {
  it('bỏ 1 bài đã quá hạn → MEDIUM; bỏ ≥ 2 → HIGH', () => {
    expect(triggersOf('LMS-01', [submittedOnly('Q01', 'Q03')])[0]?.severity).toBe(Severity.MEDIUM);
    expect(triggersOf('LMS-01', [submittedOnly('Q01')])[0]?.severity).toBe(Severity.HIGH);
  });

  it('lượt chỉ "đang làm" (không nộp) vẫn tính là bỏ bài', () => {
    const e = enrollment({
      quizAttempts: [
        attempt('Q01', '2025-09-14'),
        attempt('Q02', '2025-09-21'),
        attempt('Q03', '2025-09-28', {
          status: QuizAttemptStatus.IN_PROGRESS,
          submittedAt: null,
          score: null,
        }),
      ],
    });
    expect(triggersOf('LMS-01', [e])[0]?.inputSnapshot).toMatchObject({ missedQuizzes: 'Bài Q03' });
  });

  it('sát ngưỡng: nộp đủ bài đến hạn → không kích hoạt', () => {
    expect(triggersOf('LMS-01', [enrollment()])).toEqual([]);
  });

  it('ngoại lệ: lớp học phần không có bài trắc nghiệm (NOT_APPLICABLE) → không chạy LMS-01/02', () => {
    const e = enrollment({
      quizAttempts: [],
      lms: lmsContext({ quizApplicable: false, dueQuizzes: [] }),
    });
    expect(triggersOf('LMS-01', [e])).toEqual([]);
    expect(triggersOf('LMS-02', [e])).toEqual([]);
  });

  it('thiếu dữ liệu: chưa có bài nào đến hạn → không kích hoạt', () => {
    const e = enrollment({ quizAttempts: [], lms: lmsContext({ dueQuizzes: [] }) });
    expect(triggersOf('LMS-01', [e])).toEqual([]);
  });
});

describe('LMS-02: điểm trắc nghiệm thấp', () => {
  const scored = (q2: number[], q3: number) =>
    enrollment({
      quizAttempts: [
        attempt('Q01', '2025-09-14', { score: 9 }),
        ...q2.map((score, i) => attempt('Q02', '2025-09-21', { score, attemptNumber: i + 1 })),
        attempt('Q03', '2025-09-28', { score: q3 }),
      ],
    });

  it('2 bài gần nhất Q03 = 4/10, Q02 = 3/10 (lượt cao nhất của 2/10 và 3/10) → MEDIUM', () => {
    const [t] = triggersOf('LMS-02', [scored([2, 3], 4)]);
    expect(t?.severity).toBe(Severity.MEDIUM);
    expect(t?.inputSnapshot).toMatchObject({
      quiz1: 'Bài Q03',
      score1: 4,
      quiz2: 'Bài Q02',
      score2: 3,
    });
  });

  it('sát ngưỡng: Q03 đúng 5/10 = 50% (luật là < 50%) → không kích hoạt', () => {
    expect(triggersOf('LMS-02', [scored([3], 5)])).toEqual([]);
  });

  it('ngoại lệ: lượt thiếu điểm tối đa bị bỏ qua và ghi cảnh báo', () => {
    const e = enrollment({
      quizAttempts: [
        attempt('Q02', '2025-09-21', { score: 2 }),
        attempt('Q03', '2025-09-28', { score: 2, maxScore: null }),
      ],
    });
    const evaluation = evaluateStudent(student([e]), context());
    expect(evaluation.triggers.filter((t) => t.ruleCode === 'LMS-02')).toEqual([]);
    expect(evaluation.warnings.map((w) => w.code)).toContain('QUIZ_MAX_SCORE_MISSING');
  });

  it('thiếu dữ liệu: mới nộp 1 bài đến hạn → không xét', () => {
    expect(triggersOf('LMS-02', [submittedOnly('Q03')])).toEqual([]);
  });
});

describe('LMS-03: không nộp bài thực hành', () => {
  const withSubmissions = (...ids: string[]) =>
    enrollment({
      submissions: DUE_ASSIGNMENTS.filter((a) => ids.includes(a.activityId)).map((a) =>
        submission(a.activityId, vn('2025-09-15', '10:00')),
      ),
    });

  it('1 bài quá hạn chưa nộp → MEDIUM; 2 bài → HIGH, lý do nêu tên bài', () => {
    expect(triggersOf('LMS-03', [withSubmissions('TH01')])[0]?.severity).toBe(Severity.MEDIUM);
    const [t] = triggersOf('LMS-03', [withSubmissions()]);
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.reason).toContain('Thực hành TH01');
  });

  it('sát ngưỡng: bài chưa đến hạn mà chưa nộp → không xét', () => {
    const e = enrollment({ submissions: [], lms: lmsContext({ dueAssignments: [] }) });
    expect(triggersOf('LMS-03', [e])).toEqual([]);
  });

  it('chống rò rỉ thời gian: bài nộp SAU mốc đánh giá chưa tính là đã nộp', () => {
    const late = new Date(AS_OF.getTime() + 86_400_000);
    const e = enrollment({ submissions: [submission('TH01', late), submission('TH02', late)] });
    expect(triggersOf('LMS-03', [e])[0]?.severity).toBe(Severity.HIGH);
  });

  it('ngoại lệ: lớp học phần không có bài thực hành (NOT_APPLICABLE) → không chạy LMS-03/04', () => {
    const e = enrollment({
      submissions: [],
      lms: lmsContext({ assignmentApplicable: false, dueAssignments: [] }),
    });
    expect(triggersOf('LMS-03', [e])).toEqual([]);
    expect(triggersOf('LMS-04', [e])).toEqual([]);
  });
});

describe('LMS-04: nộp trễ bài thực hành nhiều', () => {
  const afterDue = (activityId: string, hours: number) => {
    const due = DUE_ASSIGNMENTS.find((a) => a.activityId === activityId)?.dueAt ?? AS_OF;
    return submission(
      activityId,
      new Date(due.getTime() + hours * 3_600_000),
      SubmissionStatus.LATE,
    );
  };

  it('2 bài nộp trễ → LOW (chỉ trong ứng dụng)', () => {
    const e = enrollment({ submissions: [afterDue('TH01', 30), afterDue('TH02', 2)] });
    expect(triggersOf('LMS-04', [e])[0]?.severity).toBe(Severity.LOW);
  });

  it('sát ngưỡng: 1 bài trễ → không kích hoạt; nộp đúng hạn (trước hạn 1 phút) không tính trễ', () => {
    const e = enrollment({
      submissions: [afterDue('TH01', 5), afterDue('TH02', -1 / 60)],
    });
    expect(triggersOf('LMS-04', [e])).toEqual([]);
  });

  it('trễ hay đúng hạn tính theo thời điểm nộp so với hạn, không theo nhãn trong file', () => {
    const e = enrollment({
      submissions: [
        submission('TH01', vn('2025-09-25'), SubmissionStatus.ON_TIME),
        submission('TH02', vn('2025-10-01'), SubmissionStatus.ON_TIME),
      ],
    });
    expect(triggersOf('LMS-04', [e])[0]?.severity).toBe(Severity.LOW);
  });

  it('thiếu dữ liệu: chưa nộp bài nào → LMS-04 không kích hoạt (LMS-03 xử lý)', () => {
    expect(triggersOf('LMS-04', [enrollment({ submissions: [] })])).toEqual([]);
  });
});

describe('ACA-01: không đạt học phần', () => {
  it('điểm F → HIGH, báo ngay khi học phần có kết quả', () => {
    const [t] = triggersOf('ACA-01', [completed('HP001', 'F')]);
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.scopeId).toBe('HP001');
  });

  it('lý do nêu "không được dự thi" / "vắng thi"', () => {
    const banned = completed('HP001', 'F', 3, {
      result: result('F', { eligibleForExam: false }),
    });
    const absent = completed('HP002', 'F', 3, { result: result('F', { absentFromExam: true }) });
    const reasons = triggersOf('ACA-01', [banned, absent]).map((t) => t.reason);
    expect(reasons[0]).toContain('không được dự thi');
    expect(reasons[1]).toContain('vắng thi');
  });

  it('sát ngưỡng: điểm D (đạt) → không kích hoạt', () => {
    expect(triggersOf('ACA-01', [completed('HP001', 'D')])).toEqual([]);
  });

  it('chống rò rỉ thời gian: kết quả công bố sau mốc đánh giá → chưa thấy', () => {
    const e = completed('HP001', 'F', 3, {
      result: result('F', { publishedAt: vn('2025-11-16') }),
    });
    expect(triggersOf('ACA-01', [e])).toEqual([]);
  });
});

describe('ACA-02: tín chỉ không đạt trong học kỳ (Điều 11a)', () => {
  it('rớt 2/8 tín chỉ = đúng 25% → HIGH; rớt 6/8 = 75% → CRITICAL (chạm ngưỡng quy chế)', () => {
    const quarter = [completed('A', 'F', 2), completed('B', 'B'), completed('C', 'B')];
    expect(triggersOf('ACA-02', quarter)[0]?.severity).toBe(Severity.HIGH);
    const most = [completed('A', 'D', 2), completed('B', 'F'), completed('C', 'F')];
    const [t] = triggersOf('ACA-02', most);
    expect(t?.severity).toBe(Severity.CRITICAL);
    expect(t?.reason).toContain('chạm ngưỡng cảnh báo học tập theo quy chế');
  });

  it('sát ngưỡng: rớt đúng 50% → HIGH (luật là > 50%); không rớt → không kích hoạt', () => {
    const half = [completed('A', 'F'), completed('B', 'B')];
    expect(triggersOf('ACA-02', half)[0]?.severity).toBe(Severity.HIGH);
    expect(triggersOf('ACA-02', [completed('A', 'D')])).toEqual([]);
  });

  it('ngoại lệ: còn học phần chưa có kết quả → chưa xét; lần chạy chốt học kỳ thì xét trên phần đã có', () => {
    const enrollments = [
      completed('A', 'F', 2),
      completed('B', 'B'),
      enrollment({ courseId: 'C' }),
    ];
    expect(triggersOf('ACA-02', enrollments)).toEqual([]);
    const ctx = context({}, DEFAULT_RISK_SCORE_CONFIG, AS_OF, { termClosing: true });
    const [t] = triggersOf('ACA-02', enrollments, ctx);
    expect(t?.severity).toBe(Severity.HIGH); // 2/5 = 40%
    expect(t?.reason).toContain('Còn 1 học phần chưa có kết quả');
  });

  it('thiếu dữ liệu: học phần chưa có số tín chỉ → bỏ qua + cảnh báo chất lượng dữ liệu', () => {
    const evaluation = evaluateStudent(
      student([completed('A', 'F', 3, { credits: null }), completed('B', 'B')]),
      context(),
    );
    expect(evaluation.triggers.filter((t) => t.ruleCode === 'ACA-02')).toEqual([]);
    expect(evaluation.warnings.map((w) => w.code)).toContain('COURSE_CREDITS_MISSING');
  });
});

describe('ACA-03: điểm trung bình học kỳ thấp (Điều 11b, A = 3,8)', () => {
  it('ĐTB 1,56 → HIGH; ĐTB 0,25 → CRITICAL (dưới 1,0)', () => {
    const low = [completed('A', 'D', 2), completed('B', 'D+'), completed('C', 'C')];
    expect(triggersOf('ACA-03', low)[0]?.severity).toBe(Severity.HIGH);
    const veryLow = [completed('A', 'D', 2), completed('B', 'F'), completed('C', 'F')];
    expect(triggersOf('ACA-03', veryLow)[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('sát ngưỡng: ĐTB đúng 2,0 → không; A = 3,8 làm ĐTB 1,93 → HIGH (nếu A = 4 thì đúng 2,0)', () => {
    expect(
      triggersOf('ACA-03', [completed('A', 'C', 2), completed('B', 'C'), completed('C', 'C')]),
    ).toEqual([]);
    const withA = [completed('A', 'C', 2), completed('B', 'A'), completed('C', 'F')];
    const [t] = triggersOf('ACA-03', withA);
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.inputSnapshot.gpa4).toBeCloseTo(1.925, 3);
  });

  it('ngoại lệ: học kỳ đầu khóa dùng ngưỡng quy chế 0,8 (ĐTB 0,9 → chỉ HIGH)', () => {
    const results = [completed('A', 'D', 3), completed('B', 'F', 3), completed('C', 'D', 4)];
    // ĐTB = (3 + 0 + 4) / 10 = 0,7 → dưới 0,8 → CRITICAL kể cả học kỳ đầu khóa.
    expect(triggersOf('ACA-03', results, context(), { isFirstTerm: true })[0]?.severity).toBe(
      Severity.CRITICAL,
    );
    const nine = [completed('A', 'D', 9), completed('B', 'F', 1)]; // 9 / 10 = 0,9
    expect(triggersOf('ACA-03', nine, context(), { isFirstTerm: true })[0]?.severity).toBe(
      Severity.HIGH,
    );
    expect(triggersOf('ACA-03', nine)[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('thiếu dữ liệu: điểm chữ lạ bị bỏ qua + cảnh báo chất lượng dữ liệu', () => {
    const evaluation = evaluateStudent(student([completed('A', 'X')]), context());
    expect(evaluation.triggers.filter((t) => t.ruleCode === 'ACA-03')).toEqual([]);
    expect(evaluation.warnings.map((w) => w.code)).toContain('UNKNOWN_LETTER_GRADE');
  });
});

describe('ACA-04: sa sút qua các học kỳ', () => {
  const thisTerm = (grades: [string, string, string]) =>
    grades.map((g, i) => completed(`C${i}`, g));

  it('ĐTB giảm từ 3,0 xuống 1,67 (≥ 1,0) → MEDIUM', () => {
    const before = previousTerm([
      termResult('P1', 'B'),
      termResult('P2', 'B'),
      termResult('P3', 'B'),
    ]);
    const [t] = triggersOf('ACA-04', thisTerm(['C', 'D+', 'D+']), context(), {
      previousTerm: before,
    });
    expect(t?.severity).toBe(Severity.MEDIUM);
    expect(t?.reason).toContain('ĐTB giảm từ 3');
  });

  it('2 học kỳ liên tiếp chạm ngưỡng quy chế (ĐTB < 1,0) → CRITICAL', () => {
    const before = previousTerm([
      termResult('P1', 'F'),
      termResult('P2', 'D'),
      termResult('P3', 'F'),
    ]);
    const [t] = triggersOf('ACA-04', thisTerm(['F', 'D', 'F']), context(), {
      previousTerm: before,
    });
    expect(t?.severity).toBe(Severity.CRITICAL);
    expect(t?.reason).toContain('2 học kỳ liên tiếp');
  });

  it('sát ngưỡng: giảm 0,5 → không; học kỳ trước không chạm ngưỡng quy chế → không CRITICAL', () => {
    const before = previousTerm([
      termResult('P1', 'B'),
      termResult('P2', 'C+'),
      termResult('P3', 'C+'),
    ]);
    expect(
      triggersOf('ACA-04', thisTerm(['C+', 'C+', 'C']), context(), { previousTerm: before }),
    ).toEqual([]);
  });

  it('thiếu dữ liệu: không có kết quả học kỳ trước → không xét', () => {
    expect(triggersOf('ACA-04', thisTerm(['F', 'F', 'F']))).toEqual([]);
    expect(
      triggersOf('ACA-04', thisTerm(['F', 'F', 'F']), context(), {
        previousTerm: previousTerm([]),
      }),
    ).toEqual([]);
  });
});
