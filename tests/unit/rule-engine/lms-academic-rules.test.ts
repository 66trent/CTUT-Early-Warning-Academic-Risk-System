import { describe, expect, it } from 'vitest';
import { CourseResultStatus, QuizAttemptStatus, Severity } from '@/db/enums';
import { evaluateStudent } from '@/modules/rule-engine/evaluator/engine';
import { aca03 } from '@/modules/rule-engine/evaluator/rules/aca-03';
import {
  attempt,
  context,
  DUE,
  enrollment,
  finalResult,
  result,
  student,
  triggersOf,
} from '../../helpers/evaluator-fixtures';

const submittedOnly = (...keys: string[]) =>
  enrollment({
    quizAttempts: DUE.filter((q) => keys.includes(q.quizKey)).map((q) =>
      attempt(q.quizKey, q.firstStartedAt.toISOString().slice(0, 10)),
    ),
  });

describe('LMS-01: bỏ bài kiểm tra', () => {
  it('bỏ 1 bài đến hạn → MEDIUM; bỏ ≥ 2 → HIGH', () => {
    expect(triggersOf('LMS-01', [submittedOnly('Q01', 'Q03')])[0]?.severity).toBe(Severity.MEDIUM);
    expect(triggersOf('LMS-01', [submittedOnly('Q01')])[0]?.severity).toBe(Severity.HIGH);
  });

  it('lượt chỉ "đang làm" (không nộp) vẫn tính là bỏ bài', () => {
    const e = enrollment({
      quizAttempts: [
        attempt('Q01', '2026-09-14'),
        attempt('Q02', '2026-09-21'),
        attempt('Q03', '2026-09-29', {
          status: QuizAttemptStatus.IN_PROGRESS,
          submittedAt: null,
          score: null,
        }),
      ],
    });
    expect(triggersOf('LMS-01', [e])[0]?.inputSnapshot).toMatchObject({ missedQuizzes: 'Q03' });
  });

  it('sát ngưỡng: nộp đủ bài đến hạn → không kích hoạt', () => {
    expect(triggersOf('LMS-01', [enrollment()])).toEqual([]);
  });

  it('ngoại lệ: học phần không dùng LMS (NOT_APPLICABLE) → không chạy LMS-*', () => {
    const e = enrollment({
      quizAttempts: [],
      lmsGroup: { applicable: false, groupKey: '', groupSize: 0, dueQuizzes: [] },
    });
    expect(triggersOf('LMS-01', [e])).toEqual([]);
  });

  it('thiếu dữ liệu: chưa có bài nào đến hạn → không kích hoạt', () => {
    const e = enrollment({
      quizAttempts: [],
      lmsGroup: { applicable: true, groupKey: '', groupSize: 10, dueQuizzes: [] },
    });
    expect(triggersOf('LMS-01', [e])).toEqual([]);
  });
});

describe('LMS-02: điểm kiểm tra thấp', () => {
  const scored = (q2: number[], q3: number) =>
    enrollment({
      quizAttempts: [
        attempt('Q01', '2026-09-14', { score: 9 }),
        ...q2.map((score, i) => attempt('Q02', '2026-09-21', { score, attemptNumber: i + 1 })),
        attempt('Q03', '2026-09-28', { score: q3 }),
      ],
    });

  it('2 bài gần nhất Q03 = 4/10, Q02 = 3/10 (lượt cao nhất của 2/10 và 3/10) → MEDIUM', () => {
    const [t] = triggersOf('LMS-02', [scored([2, 3], 4)]);
    expect(t?.severity).toBe(Severity.MEDIUM);
    expect(t?.inputSnapshot).toMatchObject({ quiz1: 'Q03', score1: 4, quiz2: 'Q02', score2: 3 });
  });

  it('sát ngưỡng: Q03 đúng 5/10 = 50% (luật là < 50%) → không kích hoạt', () => {
    expect(triggersOf('LMS-02', [scored([3], 5)])).toEqual([]);
  });

  it('ngoại lệ: lượt thiếu điểm tối đa bị bỏ qua và ghi cảnh báo', () => {
    const e = enrollment({
      quizAttempts: [
        attempt('Q02', '2026-09-21', { score: 2 }),
        attempt('Q03', '2026-09-28', { score: 2, maxScore: null }),
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

describe('ACA-01: điểm quá trình thấp (trước kỳ thi)', () => {
  it('điểm quá trình 4,0 → HIGH', () => {
    expect(
      triggersOf('ACA-01', [enrollment({ result: result({ processScore: 4 }) })])[0]?.severity,
    ).toBe(Severity.HIGH);
  });

  it('sát ngưỡng: đúng 5,0 (luật là < 5,0) → không kích hoạt; 4,9 → kích hoạt', () => {
    expect(triggersOf('ACA-01', [enrollment({ result: result({ processScore: 5 }) })])).toEqual([]);
    expect(
      triggersOf('ACA-01', [enrollment({ result: result({ processScore: 4.9 }) })]),
    ).toHaveLength(1);
  });

  it('ngoại lệ: kết quả đã FINAL → không xét nữa', () => {
    const e = enrollment({ result: { ...finalResult('F', false, 3), processScore: 3 } });
    expect(triggersOf('ACA-01', [e])).toEqual([]);
  });

  it('thiếu dữ liệu: chưa có kết quả, hoặc kết quả công bố SAU asOf → không xét', () => {
    expect(triggersOf('ACA-01', [enrollment()])).toEqual([]);
    const future = result({
      processScore: 3,
      publishedAt: new Date('2026-10-20T00:00:00+07:00'),
      processPublishedAt: new Date('2026-10-20T00:00:00+07:00'),
    });
    expect(triggersOf('ACA-01', [enrollment({ result: future })])).toEqual([]);
  });
});

const finals = (...rows: [string, string, boolean][]) =>
  rows.map(([courseId, letter, passed]) =>
    enrollment({
      courseId,
      enrollmentId: `E-${courseId}`,
      attendance: [],
      quizAttempts: [],
      result: finalResult(letter, passed),
    }),
  );

describe('ACA-02: rớt học phần trong học kỳ', () => {
  it('rớt 1 → HIGH; rớt 2 → CRITICAL; phạm vi là sinh viên', () => {
    expect(triggersOf('ACA-02', finals(['C1', 'F', false], ['C2', 'B', true]))[0]).toMatchObject({
      severity: Severity.HIGH,
      scopeId: 'SV001',
    });
    expect(triggersOf('ACA-02', finals(['C1', 'F', false], ['C2', 'F', false]))[0]?.severity).toBe(
      Severity.CRITICAL,
    );
  });

  it('sát ngưỡng: đạt hết (kể cả D) → không kích hoạt', () => {
    expect(triggersOf('ACA-02', finals(['C1', 'D', true], ['C2', 'D+', true]))).toEqual([]);
  });

  it('ngoại lệ: học phần đã rút không tính', () => {
    const [failed, ...rest] = finals(['C1', 'F', false], ['C2', 'B', true]);
    expect(triggersOf('ACA-02', [{ ...failed, withdrawn: true }, ...rest])).toEqual([]);
  });

  it('thiếu dữ liệu: mới có điểm quá trình (PROCESS_ONLY) → không tính rớt', () => {
    expect(triggersOf('ACA-02', [enrollment({ result: result({ processScore: 2 }) })])).toEqual([]);
  });
});

describe('ACA-03: điểm trung bình học kỳ thấp (hệ 4 quy đổi từ điểm chữ)', () => {
  it('F, D, F × 3 tín chỉ → GPA4 = 0,33 → HIGH', () => {
    const [t] = triggersOf(
      'ACA-03',
      finals(['C1', 'F', false], ['C2', 'D', true], ['C3', 'F', false]),
    );
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.inputSnapshot.gpa4).toBeCloseTo(1 / 3);
  });

  it('D, D+, C → GPA4 = 1,5 → HIGH (đạt hết nhưng điểm thấp)', () => {
    expect(
      triggersOf('ACA-03', finals(['C1', 'D', true], ['C2', 'D+', true], ['C3', 'C', true])),
    ).toHaveLength(1);
  });

  it('sát ngưỡng: F, B, B → đúng 2,0 (luật là < 2,0) → không kích hoạt', () => {
    expect(
      triggersOf('ACA-03', finals(['C1', 'F', false], ['C2', 'B', true], ['C3', 'B', true])),
    ).toEqual([]);
  });

  it('ngoại lệ: điểm chữ ngoài thang quy đổi → bỏ qua kết quả đó + cảnh báo', () => {
    const scale = { ...aca03.defaultCondition.gradeScale };
    delete scale.F;
    const ctx = context({ 'ACA-03': { ...aca03.defaultCondition, gradeScale: scale } });
    const evaluation = evaluateStudent(
      student(finals(['C1', 'F', false], ['C2', 'B', true], ['C3', 'B', true])),
      ctx,
    );
    expect(evaluation.warnings.map((w) => w.code)).toContain('UNKNOWN_LETTER_GRADE');
    expect(evaluation.triggers.filter((t) => t.ruleCode === 'ACA-03')).toEqual([]);
  });

  it('thiếu dữ liệu: dưới 6 tín chỉ có điểm, hoặc học phần chưa có số tín chỉ → không xét', () => {
    expect(triggersOf('ACA-03', finals(['C1', 'F', false]))).toEqual([]);
    const noCredits = finals(['C1', 'F', false], ['C2', 'F', false], ['C3', 'F', false]).map(
      (e) => ({ ...e, credits: null }),
    );
    expect(triggersOf('ACA-03', noCredits)).toEqual([]);
  });

  it('kết quả FINAL công bố sau asOf không được dùng (chống rò rỉ thời gian)', () => {
    const late = finals(['C1', 'F', false], ['C2', 'F', false]).map((e) => ({
      ...e,
      result: e.result && {
        ...e.result,
        resultStatus: CourseResultStatus.FINAL,
        publishedAt: new Date('2026-12-30T00:00:00+07:00'),
      },
    }));
    expect(triggersOf('ACA-02', late)).toEqual([]);
  });
});
