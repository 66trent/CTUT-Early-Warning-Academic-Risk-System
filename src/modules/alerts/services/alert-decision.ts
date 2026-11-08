import {
  AlertStatus,
  type NotificationEvent,
  OPEN_ALERT_STATUSES,
  type Severity,
  SEVERITY_ORDER,
} from '@/db/enums';

/** 1 dấu hiệu = 1 cặp (luật, phạm vi) với mức của lần chạy (docs/rules/08). */
export interface Signal {
  ruleCode: string;
  scopeId: string;
  severity: Severity;
}

export interface ExistingAlertState {
  status: AlertStatus;
  severity: Severity;
  lastAsOf: Date;
  closedAt: Date | null;
  /** Mức cao nhất đã ghi nhận của từng dấu hiệu (`ruleCode|scopeId`) trong mọi trigger đã gắn. */
  knownSignals: ReadonlyMap<string, Severity>;
}

export type AlertDecision =
  | { action: 'CREATE'; severity: Severity; event: 'CREATED' }
  | { action: 'UPDATE'; severity: Severity; event: NotificationEvent | null }
  | { action: 'REOPEN'; severity: Severity; event: 'REOPENED' }
  | { action: 'EVIDENCE_ONLY' };

export const signalKey = (s: Pick<Signal, 'ruleCode' | 'scopeId'>) => `${s.ruleCode}|${s.scopeId}`;
const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);
const HOUR_MS = 3600 * 1000;

function maxOf(signals: readonly Signal[]): Severity {
  return signals.reduce(
    (m, s) => (rank(s.severity) > rank(m) ? s.severity : m),
    signals[0].severity,
  );
}

/** Có dấu hiệu MỚI (cặp luật–phạm vi chưa có) hoặc dấu hiệu cũ NẶNG HƠN mức đã ghi nhận. */
export function hasNewOrWorseSignal(
  signals: readonly Signal[],
  known: ReadonlyMap<string, Severity>,
): boolean {
  return signals.some((s) => {
    const before = known.get(signalKey(s));
    return before === undefined || rank(s.severity) > rank(before);
  });
}

/**
 * Quyết định cập nhật cảnh báo của 1 sinh viên × học kỳ từ dấu hiệu của 1 lần chạy (docs/rules/08,
 * bước 7–9). Hàm thuần. `signals` không rỗng. `existing` = cảnh báo chưa INVALIDATED (hoặc null).
 * `partial` = lần chạy chỉ 1 học phần: không thấy dấu hiệu học phần khác → chỉ được TĂNG mức.
 */
export function decideAlertUpdate(
  existing: ExistingAlertState | null,
  signals: readonly Signal[],
  ctx: { asOf: Date; now: Date; cooldownHours: number; partial?: boolean },
): AlertDecision {
  const runSeverity = maxOf(signals);
  const severity =
    ctx.partial && existing && rank(existing.severity) > rank(runSeverity)
      ? existing.severity
      : runSeverity;
  if (!existing) return { action: 'CREATE', severity, event: 'CREATED' };
  // Lần chạy mốc cũ hơn dữ liệu đã áp dụng (VD chạy lại mốc quá khứ khi demo): chỉ thêm bằng chứng.
  if (ctx.asOf < existing.lastAsOf) return { action: 'EVIDENCE_ONLY' };

  if (OPEN_ALERT_STATUSES.includes(existing.status)) {
    const increased = rank(severity) > rank(existing.severity);
    return { action: 'UPDATE', severity, event: increased ? 'SEVERITY_INCREASED' : null };
  }
  if (existing.status === AlertStatus.RESOLVED || existing.status === AlertStatus.DISMISSED) {
    const inCooldown =
      ctx.cooldownHours > 0 &&
      existing.closedAt !== null &&
      ctx.now.getTime() - existing.closedAt.getTime() < ctx.cooldownHours * HOUR_MS;
    if (!inCooldown && hasNewOrWorseSignal(signals, existing.knownSignals)) {
      return { action: 'REOPEN', severity, event: 'REOPENED' };
    }
  }
  return { action: 'EVIDENCE_ONLY' };
}
