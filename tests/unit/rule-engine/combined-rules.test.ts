import { describe, expect, it } from 'vitest';
import { CourseResultStatus, Severity } from '@/db/enums';
import {
  attempt,
  DUE,
  enrollment,
  result,
  snapshot,
  triggersOf,
} from '../../helpers/evaluator-fixtures';

/** Vắng 3/30 (MEDIUM ATT-01) + bỏ Q02 (MEDIUM LMS-01) — như KTPM2311008 trong demo. */
const twoSources = (over = {}) =>
  enrollment({
    attendance: [
      snapshot('2026-10-09', { present: 12, late: 1, excusedAbsence: 1, unexcusedAbsence: 2 }),
    ],
    quizAttempts: [attempt('Q01', '2026-09-14'), attempt('Q03', '2026-09-28')],
    ...over,
  });

const failedBefore = [
  {
    termId: 'HK2_2025',
    termName: 'Học kỳ 2, 2025–2026',
    result: {
      resultStatus: CourseResultStatus.FINAL,
      passed: false,
      publishedAt: new Date('2026-06-10T00:00:00+07:00'),
    },
  },
];

describe('COMB-01: nhiều nguồn cùng xấu', () => {
  it('điểm danh MEDIUM + LMS MEDIUM → CRITICAL', () => {
    expect(triggersOf('COMB-01', [twoSources()])[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('sát ngưỡng: 2 luật cùng nhóm điểm danh (ATT-01 + ATT-02) chỉ là 1 nhóm → không kích hoạt', () => {
    const e = enrollment({
      attendance: [
        snapshot('2026-10-02', {
          totalSessions: 14,
          present: 12,
          excusedAbsence: 1,
          unexcusedAbsence: 1,
        }),
        snapshot('2026-10-09', { present: 9, excusedAbsence: 1, unexcusedAbsence: 6 }),
      ],
    });
    expect(triggersOf('ATT-02', [e])).toHaveLength(1);
    expect(triggersOf('COMB-01', [e])).toEqual([]);
  });

  it('ngoại lệ: tín hiệu LOW (ATT-03) không được tính', () => {
    const e = twoSources({
      attendance: [snapshot('2026-10-09', { present: 13, late: 3 })],
    });
    expect(triggersOf('COMB-01', [e])).toEqual([]);
  });

  it('thiếu dữ liệu: LMS NOT_APPLICABLE → chỉ còn 1 nhóm → không kích hoạt', () => {
    const e = twoSources({
      quizAttempts: [],
      lmsGroup: { applicable: false, groupKey: '', groupSize: 0, dueQuizzes: [] },
    });
    expect(triggersOf('COMB-01', [e])).toEqual([]);
  });

  it('điểm danh + học lực (ACA-01) cũng tính là 2 nhóm', () => {
    const e = twoSources({
      quizAttempts: DUE.map((q) => attempt(q.quizKey, q.firstStartedAt.toISOString().slice(0, 10))),
      result: result({ processScore: 4 }),
    });
    expect(triggersOf('COMB-01', [e])).toHaveLength(1);
  });
});

describe('COMB-02: học lại vẫn sa sút', () => {
  const retaking = (over = {}) =>
    enrollment({
      courseId: 'KTPM103',
      quizAttempts: [],
      lmsGroup: {
        applicable: true,
        groupKey: '',
        groupSize: 3,
        dueQuizzes: [
          {
            quizKey: 'QA',
            quizName: 'Kiểm tra Mạng 1',
            firstStartedAt: new Date('2026-09-15T09:00:00+07:00'),
          },
        ],
      },
      priorAttempts: failedBefore,
      ...over,
    });

  it('lần học 2 + LMS-01 MEDIUM → nâng 1 bậc = HIGH, lý do nêu học kỳ đã rớt', () => {
    const [t] = triggersOf('COMB-02', [retaking()]);
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.reason).toContain('đã rớt ở Học kỳ 2, 2025–2026');
    expect(t?.inputSnapshot).toMatchObject({ attemptNumber: 2, failedTerms: 'HK2_2025' });
  });

  it('nâng tối đa đến CRITICAL', () => {
    const e = retaking({
      attendance: [snapshot('2026-10-09', { present: 9, unexcusedAbsence: 7 })],
    });
    expect(triggersOf('COMB-02', [e])[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('sát ngưỡng: học lần đầu (không có kỳ rớt trước) → không kích hoạt', () => {
    expect(triggersOf('COMB-02', [retaking({ priorAttempts: [] })])).toEqual([]);
  });

  it('ngoại lệ: kết quả rớt kỳ trước công bố SAU asOf → chưa tính là học lại', () => {
    const later = [
      {
        ...failedBefore[0],
        result: { ...failedBefore[0].result, publishedAt: new Date('2026-11-01T00:00:00+07:00') },
      },
    ];
    expect(triggersOf('COMB-02', [retaking({ priorAttempts: later })])).toEqual([]);
  });

  it('thiếu dữ liệu: học lại nhưng không có tín hiệu điểm danh/LMS → không kích hoạt', () => {
    const e = retaking({ quizAttempts: [attempt('QA', '2026-09-15')] });
    expect(triggersOf('COMB-02', [e])).toEqual([]);
  });

  it('chỉ có trigger học lực (ACA-01) thì không tính cho COMB-02', () => {
    const e = retaking({
      quizAttempts: [attempt('QA', '2026-09-15')],
      result: result({ processScore: 3 }),
    });
    expect(triggersOf('ACA-01', [e])).toHaveLength(1);
    expect(triggersOf('COMB-02', [e])).toEqual([]);
  });
});
