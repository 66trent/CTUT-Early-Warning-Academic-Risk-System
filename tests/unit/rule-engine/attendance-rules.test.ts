import { describe, expect, it } from 'vitest';
import { Severity } from '@/db/enums';
import { DEFAULT_RISK_SCORE_CONFIG } from '@/modules/rule-engine/evaluator/config';
import { evaluateStudent } from '@/modules/rule-engine/evaluator/engine';
import { att01 } from '@/modules/rule-engine/evaluator/rules/att-01';
import {
  context,
  enrollment,
  result,
  snapshot,
  student,
  triggersOf,
} from '../../helpers/evaluator-fixtures';

/** Học phần 30 tiết (mặc định fixture 45). */
const withAbsence = (excused: number, unexcused: number, totalPeriods = 30) =>
  enrollment({
    attendance: [
      snapshot('2025-10-09', {
        totalPeriods,
        excusedAbsence: excused,
        unexcusedAbsence: unexcused,
      }),
    ],
  });

describe('ATT-01: vắng gần ngưỡng cấm thi (tiết vắng / tổng số tiết)', () => {
  it.each([
    [1, 2, Severity.MEDIUM, 'đúng 10% → MEDIUM'],
    [0, 5, Severity.HIGH, '16,7% → HIGH'],
    [2, 4, Severity.HIGH, 'đúng 20% → HIGH, chưa vượt nên không CRITICAL'],
    [1, 6, Severity.CRITICAL, '23,3% > 20% → CRITICAL'],
  ])('vắng %i có phép + %i không phép /30 tiết: %s', (excused, unexcused, severity) => {
    const [t] = triggersOf('ATT-01', [withAbsence(excused, unexcused)]);
    expect(t?.severity).toBe(severity);
  });

  it('sát ngưỡng: 4/45 tiết = 8,9% → không kích hoạt; 5/45 = 11,1% → MEDIUM', () => {
    expect(triggersOf('ATT-01', [withAbsence(4, 0, 45)])).toEqual([]);
    expect(triggersOf('ATT-01', [withAbsence(2, 3, 45)])[0]?.severity).toBe(Severity.MEDIUM);
  });

  it('CRITICAL nêu rõ đã vượt ngưỡng cấm thi, số liệu nằm trong inputSnapshot', () => {
    const [t] = triggersOf('ATT-01', [withAbsence(1, 6)]);
    expect(t?.reason).toContain('Vắng 7/30 tiết (23,3%)');
    expect(t?.reason).toContain('vượt ngưỡng cấm thi 20%');
    expect(t?.inputSnapshot).toMatchObject({ absences: 7, totalPeriods: 30 });
  });

  it('đầu kỳ không bị phóng đại: mẫu số là tổng số tiết cố định (vắng 3/45 → không cảnh báo)', () => {
    expect(triggersOf('ATT-01', [withAbsence(0, 3, 45)])).toEqual([]);
  });

  it('ngoại lệ: Enrollment đã rút (WITHDRAWN) → bỏ qua mọi luật', () => {
    const e = { ...withAbsence(1, 6), withdrawn: true };
    expect(evaluateStudent(student([e]), context()).triggers).toEqual([]);
  });

  it('ngoại lệ: học phần đã có kết quả (COMPLETED) → luật điểm danh không xét nữa', () => {
    const e = { ...withAbsence(1, 6), result: result('B') };
    expect(triggersOf('ATT-01', [e])).toEqual([]);
  });

  it('thiếu dữ liệu: chưa có điểm danh (MISSING) hoặc quá 14 ngày (STALE) → không chạy ATT-*', () => {
    expect(triggersOf('ATT-01', [enrollment({ attendance: [] })])).toEqual([]);
    const stale = enrollment({
      attendance: [snapshot('2025-09-20', { totalPeriods: 30, unexcusedAbsence: 7 })],
    });
    expect(triggersOf('ATT-01', [stale])).toEqual([]);
  });

  it('cấu hình: không tính tiết vắng có phép', () => {
    const ctx = context({ 'ATT-01': { ...att01.defaultCondition, countExcused: false } });
    expect(triggersOf('ATT-01', [withAbsence(3, 1)], ctx)).toEqual([]); // 1/30 = 3,3%
  });

  it('dữ liệu mâu thuẫn (INVALID) → loại, có cảnh báo chất lượng dữ liệu', () => {
    const e = enrollment({
      attendance: [
        snapshot('2025-10-09', { totalPeriods: 30, excusedAbsence: 20, unexcusedAbsence: 15 }),
      ],
    });
    const evaluation = evaluateStudent(student([e]), context());
    expect(evaluation.triggers.filter((t) => t.ruleCode.startsWith('ATT'))).toEqual([]);
    expect(evaluation.warnings.map((w) => w.code)).toContain('ATTENDANCE_INVALID');
  });
});

describe('ATT-02: vắng tăng nhanh (theo % tổng số tiết)', () => {
  const twoSnapshots = (
    before: number,
    after: number,
    totalPeriods = 45,
    firstDate = '2025-10-02',
  ) =>
    enrollment({
      attendance: [
        snapshot(firstDate, { totalPeriods, unexcusedAbsence: before }),
        snapshot('2025-10-09', { totalPeriods, unexcusedAbsence: after }),
      ],
    });

  it('vắng không phép 2 → 8 tiết trong 7 ngày (môn 45 tiết, tăng 13%) → HIGH', () => {
    const [t] = triggersOf('ATT-02', [twoSnapshots(2, 8)]);
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.inputSnapshot).toMatchObject({ increase: 6, days: 7, totalPeriods: 45 });
  });

  it('sát ngưỡng: tăng 4 tiết (< 4,5 = 10% của 45) → không; môn 30 tiết tăng 3 (= 10%) → HIGH', () => {
    expect(triggersOf('ATT-02', [twoSnapshots(5, 9)])).toEqual([]);
    expect(triggersOf('ATT-02', [twoSnapshots(4, 7, 30)])[0]?.severity).toBe(Severity.HIGH);
  });

  it('ngoại lệ: 2 snapshot cách nhau quá 14 ngày → không so', () => {
    expect(triggersOf('ATT-02', [twoSnapshots(0, 10, 45, '2025-09-20')])).toEqual([]);
  });

  it('thiếu dữ liệu: chỉ có 1 snapshot → không xét', () => {
    expect(triggersOf('ATT-02', [enrollment()])).toEqual([]);
  });

  it('số vắng giảm (dữ liệu bị sửa) → không kích hoạt, ghi cảnh báo chất lượng dữ liệu', () => {
    const evaluation = evaluateStudent(student([twoSnapshots(9, 3)]), context());
    expect(evaluation.triggers.filter((t) => t.ruleCode === 'ATT-02')).toEqual([]);
    expect(evaluation.warnings.map((w) => w.code)).toContain('ATTENDANCE_DECREASED');
  });

  it('thiếu dữ liệu: điểm danh STALE → không chạy', () => {
    const config = {
      ...DEFAULT_RISK_SCORE_CONFIG,
      attendance: { ...DEFAULT_RISK_SCORE_CONFIG.attendance, freshnessDays: 1 },
    };
    expect(triggersOf('ATT-02', [twoSnapshots(0, 10)], context({}, config))).toEqual([]);
  });
});
