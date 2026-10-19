import { describe, expect, it } from 'vitest';
import { Severity } from '@/db/enums';
import {
  attempt,
  enrollment,
  lmsContext,
  result,
  snapshot,
  submission,
  triggersOf,
  vn,
} from '../../helpers/evaluator-fixtures';

/** Vắng 5/45 (MEDIUM ATT-01) + không nộp TH01 (MEDIUM LMS-03) — như KTPM2411910 trong demo. */
const attendanceAndAssignment = (over = {}) =>
  enrollment({
    attendance: [snapshot('2025-10-09', { excusedAbsence: 2, unexcusedAbsence: 3 })],
    submissions: [submission('TH02', vn('2025-09-20'))],
    ...over,
  });

const failedBefore = [
  {
    termId: 'HK3_2024',
    termName: 'Học kỳ 3, 2024–2025',
    result: { passed: false, publishedAt: vn('2025-07-20') },
  },
];

describe('COMB-01: nhiều nguồn cùng xấu (điểm danh · trắc nghiệm · thực hành)', () => {
  it('điểm danh MEDIUM + thực hành MEDIUM → CRITICAL', () => {
    expect(triggersOf('COMB-01', [attendanceAndAssignment()])[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('trắc nghiệm (LMS-01) + thực hành (LMS-03) là 2 nguồn khác nhau → CRITICAL', () => {
    const e = enrollment({
      quizAttempts: [attempt('Q01', '2025-09-14'), attempt('Q02', '2025-09-21')],
      submissions: [submission('TH02', vn('2025-09-20'))],
    });
    expect(triggersOf('COMB-01', [e])[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('sát ngưỡng: ATT-01 + ATT-02 cùng nguồn điểm danh chỉ là 1 nguồn → không kích hoạt', () => {
    const e = enrollment({
      attendance: [
        snapshot('2025-10-02', { excusedAbsence: 1, unexcusedAbsence: 1 }),
        snapshot('2025-10-09', { excusedAbsence: 1, unexcusedAbsence: 8 }),
      ],
    });
    expect(triggersOf('ATT-02', [e])).toHaveLength(1);
    expect(triggersOf('COMB-01', [e])).toEqual([]);
  });

  it('ngoại lệ: tín hiệu LOW (LMS-04 nộp trễ) không được tính', () => {
    const late = (id: string, date: string) => submission(id, vn(date));
    const e = attendanceAndAssignment({
      submissions: [late('TH01', '2025-09-25'), late('TH02', '2025-10-01')],
    });
    expect(triggersOf('LMS-04', [e])).toHaveLength(1);
    expect(triggersOf('COMB-01', [e])).toEqual([]);
  });

  it('thiếu dữ liệu: thực hành NOT_APPLICABLE → chỉ còn 1 nguồn → không kích hoạt', () => {
    const e = attendanceAndAssignment({
      submissions: [],
      lms: lmsContext({ assignmentApplicable: false, dueAssignments: [] }),
    });
    expect(triggersOf('COMB-01', [e])).toEqual([]);
  });
});

describe('COMB-02: học lại vẫn sa sút', () => {
  const retaking = (over = {}) =>
    enrollment({
      courseId: 'HP103',
      quizAttempts: [attempt('Q01', '2025-09-14'), attempt('Q02', '2025-09-21')],
      priorAttempts: failedBefore,
      ...over,
    });

  it('lần học 2 + LMS-01 MEDIUM → nâng 1 bậc = HIGH, lý do nêu học kỳ đã rớt', () => {
    const [t] = triggersOf('COMB-02', [retaking()]);
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.reason).toContain('đã rớt ở Học kỳ 3, 2024–2025');
    expect(t?.inputSnapshot).toMatchObject({ attemptNumber: 2, failedTerms: 'HK3_2024' });
  });

  it('nâng tối đa đến CRITICAL', () => {
    const e = retaking({
      attendance: [snapshot('2025-10-09', { totalPeriods: 30, unexcusedAbsence: 7 })],
    });
    expect(triggersOf('COMB-02', [e])[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('sát ngưỡng: học lần đầu (không có kỳ rớt trước) → không kích hoạt', () => {
    expect(triggersOf('COMB-02', [retaking({ priorAttempts: [] })])).toEqual([]);
  });

  it('ngoại lệ: kết quả rớt kỳ trước công bố SAU asOf → chưa tính là học lại', () => {
    const later = [
      { ...failedBefore[0], result: { passed: false, publishedAt: vn('2025-11-01') } },
    ];
    expect(triggersOf('COMB-02', [retaking({ priorAttempts: later })])).toEqual([]);
  });

  it('thiếu dữ liệu: học lại nhưng không có tín hiệu điểm danh/LMS → không kích hoạt', () => {
    expect(triggersOf('COMB-02', [enrollment({ priorAttempts: failedBefore })])).toEqual([]);
  });

  it('học phần học lại đã có kết quả (COMPLETED) → COMB-02 không xét, chỉ ACA-01 nếu rớt', () => {
    const e = retaking({ result: result('F') });
    expect(triggersOf('ACA-01', [e])).toHaveLength(1);
    expect(triggersOf('COMB-02', [e])).toEqual([]);
  });
});
