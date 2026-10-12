import { describe, expect, it } from 'vitest';
import { Severity } from '@/db/enums';
import { DEFAULT_RISK_SCORE_CONFIG } from '@/modules/rule-engine/evaluator/config';
import { evaluateStudent } from '@/modules/rule-engine/evaluator/engine';
import { att01 } from '@/modules/rule-engine/evaluator/rules/att-01';
import {
  context,
  enrollment,
  snapshot,
  student,
  triggersOf,
} from '../../helpers/evaluator-fixtures';

const withAbsence = (excused: number, unexcused: number, over = {}) =>
  enrollment({
    attendance: [
      snapshot('2026-10-09', {
        excusedAbsence: excused,
        unexcusedAbsence: unexcused,
        present: 16 - excused - unexcused,
        ...over,
      }),
    ],
  });

describe('ATT-01: tỷ lệ vắng so với ngưỡng cấm thi (mẫu số = buổi kế hoạch)', () => {
  it.each([
    [1, 2, Severity.MEDIUM, 'đúng 10% → MEDIUM'],
    [0, 5, Severity.HIGH, '16,7% → HIGH'],
    [2, 4, Severity.HIGH, 'đúng 20% → HIGH, chưa vượt nên không CRITICAL'],
    [1, 6, Severity.CRITICAL, '23,3% > 20% → CRITICAL'],
  ])('vắng %i có phép + %i không phép /30: %s', (excused, unexcused, severity) => {
    const [t] = triggersOf('ATT-01', [withAbsence(excused, unexcused)]);
    expect(t?.severity).toBe(severity);
  });

  it('sát ngưỡng: 2/30 = 6,7% → không kích hoạt', () => {
    expect(triggersOf('ATT-01', [withAbsence(1, 1)])).toEqual([]);
  });

  it('CRITICAL nêu rõ đã vượt ngưỡng cấm thi, số liệu nằm trong inputSnapshot', () => {
    const [t] = triggersOf('ATT-01', [withAbsence(1, 6)]);
    expect(t?.reason).toContain('Vắng 7/30 buổi theo kế hoạch (23,3%)');
    expect(t?.reason).toContain('vượt ngưỡng cấm thi 20%');
    expect(t?.inputSnapshot).toMatchObject({
      absences: 7,
      denominator: 30,
      denominatorType: 'PLANNED',
    });
  });

  it('ngoại lệ: mới học 3 buổi (< minSessions 4) → không xét', () => {
    const e = enrollment({
      attendance: [
        snapshot('2026-10-09', {
          totalSessions: 3,
          present: 1,
          unexcusedAbsence: 2,
          plannedSessions: 15,
        }),
      ],
    });
    expect(triggersOf('ATT-01', [e])).toEqual([]);
  });

  it('ngoại lệ: Enrollment đã rút (WITHDRAWN) → bỏ qua mọi luật', () => {
    const e = { ...withAbsence(1, 6), withdrawn: true };
    expect(evaluateStudent(student([e]), context()).triggers).toEqual([]);
  });

  it('thiếu dữ liệu: chưa có điểm danh (MISSING) hoặc quá 14 ngày (STALE) → không chạy ATT-*', () => {
    expect(triggersOf('ATT-01', [enrollment({ attendance: [] })])).toEqual([]);
    const stale = enrollment({
      attendance: [snapshot('2026-09-20', { unexcusedAbsence: 7, present: 9 })],
    });
    expect(triggersOf('ATT-01', [stale])).toEqual([]);
  });

  it('nguồn không có số buổi kế hoạch → dùng số buổi đã học và ghi rõ trong lý do', () => {
    const e = withAbsence(0, 2, { plannedSessions: null });
    const [t] = triggersOf('ATT-01', [e]);
    expect(t?.severity).toBe(Severity.MEDIUM); // 2/16 = 12,5%
    expect(t?.reason).toContain('nguồn không có số buổi kế hoạch');
  });

  it('cấu hình: không tính vắng có phép, quy đổi 3 lần trễ = 1 buổi vắng', () => {
    const e = withAbsence(3, 1, { late: 3, present: 9 });
    const ctx = context({
      'ATT-01': { ...att01.defaultCondition, countExcused: false, lateToAbsenceRatio: 3 },
    });
    expect(triggersOf('ATT-01', [e], ctx)).toEqual([]); // (1 + 1)/30 = 6,7%
  });

  it('dữ liệu mâu thuẫn (INVALID) → loại, có cảnh báo chất lượng dữ liệu', () => {
    const e = enrollment({
      attendance: [snapshot('2026-10-09', { present: 16, unexcusedAbsence: 5 })],
    });
    const evaluation = evaluateStudent(student([e]), context());
    expect(evaluation.triggers.filter((t) => t.ruleCode.startsWith('ATT'))).toEqual([]);
    expect(evaluation.warnings.map((w) => w.code)).toContain('ATTENDANCE_INVALID');
  });
});

describe('ATT-02: vắng tăng nhanh', () => {
  const twoSnapshots = (before: number, after: number, firstDate = '2026-10-02') =>
    enrollment({
      attendance: [
        snapshot(firstDate, { totalSessions: 14, present: 14 - before, unexcusedAbsence: before }),
        snapshot('2026-10-09', { present: 16 - after, unexcusedAbsence: after }),
      ],
    });

  it('vắng không phép 1 → 6 trong 7 ngày → HIGH', () => {
    const [t] = triggersOf('ATT-02', [twoSnapshots(1, 6)]);
    expect(t?.severity).toBe(Severity.HIGH);
    expect(t?.inputSnapshot).toMatchObject({ increase: 5, days: 7 });
  });

  it('sát ngưỡng: tăng 1 (< 2) → không kích hoạt', () => {
    expect(triggersOf('ATT-02', [twoSnapshots(1, 2)])).toEqual([]);
  });

  it('ngoại lệ: 2 snapshot cách nhau quá 14 ngày → không so', () => {
    expect(triggersOf('ATT-02', [twoSnapshots(0, 5, '2026-09-20')])).toEqual([]);
  });

  it('thiếu dữ liệu: chỉ có 1 snapshot → không xét', () => {
    expect(triggersOf('ATT-02', [enrollment()])).toEqual([]);
  });

  it('số vắng giảm (dữ liệu bị sửa) → không kích hoạt, ghi cảnh báo chất lượng dữ liệu', () => {
    const evaluation = evaluateStudent(student([twoSnapshots(4, 1)]), context());
    expect(evaluation.triggers.filter((t) => t.ruleCode === 'ATT-02')).toEqual([]);
    expect(evaluation.warnings.map((w) => w.code)).toContain('ATTENDANCE_DECREASED');
  });
});

describe('ATT-03: đi trễ nhiều', () => {
  const late = (n: number) =>
    enrollment({ attendance: [snapshot('2026-10-09', { late: n, present: 16 - n })] });

  it('đi trễ 3 buổi → LOW', () => {
    expect(triggersOf('ATT-03', [late(3)])[0]?.severity).toBe(Severity.LOW);
  });

  it('sát ngưỡng: trễ 2 buổi → không kích hoạt', () => {
    expect(triggersOf('ATT-03', [late(2)])).toEqual([]);
  });

  it('ngoại lệ: tắt luật (không có phiên bản ACTIVE) → không chạy', () => {
    const base = context();
    const ctx = {
      ...base,
      activeRules: new Map([...base.activeRules].filter(([code]) => code !== 'ATT-03')),
    };
    expect(triggersOf('ATT-03', [late(5)], ctx)).toEqual([]);
  });

  it('thiếu dữ liệu: điểm danh STALE → không chạy', () => {
    const config = {
      ...DEFAULT_RISK_SCORE_CONFIG,
      attendance: { ...DEFAULT_RISK_SCORE_CONFIG.attendance, freshnessDays: 1 },
    };
    const e = enrollment({ attendance: [snapshot('2026-10-05', { late: 4, present: 12 })] });
    expect(triggersOf('ATT-03', [e], context({}, config))).toEqual([]);
  });
});
