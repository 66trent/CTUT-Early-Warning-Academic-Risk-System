import { describe, expect, it } from 'vitest';
import { AlertStatus, Severity } from '@/db/enums';
import {
  decideAlertUpdate,
  type ExistingAlertState,
  type Signal,
} from '@/modules/alerts/services/alert-decision';
import { evidenceRows, sourceOf } from '@/modules/alerts/services/alert-presentation';

const now = new Date('2026-10-13T10:00:00+07:00');
const asOf = new Date('2026-10-10T23:59:59+07:00');
const sig = (ruleCode: string, severity: Severity, scopeId = 'KTPM201'): Signal => ({
  ruleCode,
  scopeId,
  severity,
});
const existing = (over: Partial<ExistingAlertState> = {}): ExistingAlertState => ({
  status: AlertStatus.OPEN,
  severity: Severity.MEDIUM,
  lastAsOf: asOf,
  closedAt: null,
  knownSignals: new Map([['ATT-01|KTPM201', Severity.MEDIUM]]),
  ...over,
});
const decide = (e: ExistingAlertState | null, signals: Signal[], cooldownHours = 0) =>
  decideAlertUpdate(e, signals, { asOf, now, cooldownHours });

describe('Gộp dấu hiệu vào cảnh báo (docs/rules/08 bước 7–9)', () => {
  it('chưa có cảnh báo → tạo mới, mức = cao nhất các dấu hiệu, thông báo CREATED', () => {
    expect(decide(null, [sig('ATT-01', Severity.MEDIUM), sig('ATT-02', Severity.HIGH)])).toEqual({
      action: 'CREATE',
      severity: Severity.HIGH,
      event: 'CREATED',
    });
  });

  it('đang mở: mức tăng → thông báo; giữ nguyên hoặc giảm → chỉ cập nhật', () => {
    expect(decide(existing(), [sig('ATT-01', Severity.HIGH)])).toMatchObject({
      action: 'UPDATE',
      severity: Severity.HIGH,
      event: 'SEVERITY_INCREASED',
    });
    expect(decide(existing(), [sig('ATT-01', Severity.MEDIUM)])).toMatchObject({ event: null });
    expect(decide(existing({ severity: Severity.HIGH }), [sig('ATT-01', Severity.LOW)])).toEqual({
      action: 'UPDATE',
      severity: Severity.LOW,
      event: null,
    });
  });

  it('đã đóng: dấu hiệu y hệt hoặc nhẹ hơn → chỉ thêm bằng chứng (không mở lại)', () => {
    const closed = existing({ status: AlertStatus.RESOLVED, closedAt: now });
    expect(decide(closed, [sig('ATT-01', Severity.MEDIUM)])).toEqual({ action: 'EVIDENCE_ONLY' });
    expect(decide(closed, [sig('ATT-01', Severity.LOW)])).toEqual({ action: 'EVIDENCE_ONLY' });
  });

  it('đã đóng: dấu hiệu MỚI (luật hoặc học phần khác) hoặc NẶNG HƠN → mở lại', () => {
    const closed = existing({ status: AlertStatus.DISMISSED, closedAt: now });
    expect(decide(closed, [sig('ACA-01', Severity.HIGH)])).toMatchObject({ action: 'REOPEN' });
    expect(decide(closed, [sig('ATT-01', Severity.MEDIUM, 'KTPM103')])).toMatchObject({
      action: 'REOPEN',
    });
    expect(decide(closed, [sig('ATT-01', Severity.CRITICAL)])).toEqual({
      action: 'REOPEN',
      severity: Severity.CRITICAL,
      event: 'REOPENED',
    });
  });

  it('cooldown > 0: còn trong thời gian chờ → chưa mở lại; hết thời gian → mở lại', () => {
    const closed = existing({
      status: AlertStatus.RESOLVED,
      closedAt: new Date(now.getTime() - 2 * 3600 * 1000),
    });
    expect(decide(closed, [sig('ACA-01', Severity.HIGH)], 3)).toEqual({ action: 'EVIDENCE_ONLY' });
    expect(decide(closed, [sig('ACA-01', Severity.HIGH)], 1)).toMatchObject({ action: 'REOPEN' });
  });

  it('lần chạy mốc CŨ hơn dữ liệu đã áp dụng → chỉ thêm bằng chứng, kể cả khi nặng hơn', () => {
    const newer = existing({ lastAsOf: new Date('2026-10-16T23:59:59+07:00') });
    expect(decide(newer, [sig('ATT-01', Severity.CRITICAL)])).toEqual({ action: 'EVIDENCE_ONLY' });
  });

  it('INVALIDATED là trạng thái cuối — không mở lại (cảnh báo mới do tầng gọi tạo)', () => {
    expect(
      decide(existing({ status: AlertStatus.INVALIDATED }), [sig('ACA-01', Severity.HIGH)]),
    ).toEqual({ action: 'EVIDENCE_ONLY' });
  });
});

describe('Hiển thị dấu hiệu cho Cố vấn học tập', () => {
  it('nhóm theo 3 nguồn theo mã luật', () => {
    expect(['ATT-02', 'LMS-01', 'ACA-03', 'COMB-02'].map(sourceOf)).toEqual([
      'ATTENDANCE',
      'LMS',
      'ACADEMIC',
      'COMBINED',
    ]);
  });

  it('bằng chứng chi tiết có nhãn tiếng Việt, tỷ lệ dạng %, thứ tự cố định (jsonb không giữ thứ tự)', () => {
    expect(
      evidenceRows({
        snapshotDate: '2026-10-09',
        rate: 0.2333,
        denominatorType: 'PLANNED',
        quiz1: 'Q03',
      }),
    ).toEqual([
      { label: 'Ngày chốt số liệu', value: '2026-10-09' },
      { label: 'Loại mẫu số', value: 'Buổi theo kế hoạch' },
      { label: 'Tỷ lệ vắng', value: '23,3%' },
      { label: 'Bài 1', value: 'Q03' },
    ]);
  });
});
