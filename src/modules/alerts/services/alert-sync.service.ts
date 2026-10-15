import { randomUUID } from 'node:crypto';
import { In, Not, type EntityManager } from 'typeorm';
import { Alert } from '@/db/entities/alert.entity';
import { Rule } from '@/db/entities/rule.entity';
import { Student } from '@/db/entities/student.entity';
import {
  AlertStatus,
  type NotificationEvent,
  OPEN_ALERT_STATUSES,
  type Severity,
} from '@/db/enums';
import {
  type AlertDecision,
  decideAlertUpdate,
  type ExistingAlertState,
  type Signal,
  signalKey,
} from './alert-decision';
import { recordAlertTransition } from './alert-history';

/** Kết quả đánh giá 1 sinh viên ở 1 lần chạy — đầu vào gộp cảnh báo. */
export interface StudentRunSignals {
  studentId: string;
  riskScoreLogId: string | null;
  signals: Signal[];
}

/** Sự kiện cần thông báo (docs/rules/06). `recipientId` NULL = lớp chưa có Cố vấn học tập. */
export interface AlertEvent {
  alertId: string;
  event: NotificationEvent;
  severity: Severity;
  recipientId: string | null;
}

export interface AlertSyncResult {
  /** Cảnh báo để gắn trigger của từng sinh viên (kể cả khi chỉ thêm bằng chứng). */
  alertIdByStudent: Map<string, string>;
  created: number;
  updated: number;
  events: AlertEvent[];
}

interface RunInfo {
  id: string;
  termId: string;
  asOf: Date;
}

/** Mức cao nhất đã ghi nhận của từng dấu hiệu, theo cảnh báo — MAX trên enum Postgres theo thứ tự khai báo. */
async function loadKnownSignals(
  em: EntityManager,
  alertIds: string[],
): Promise<Map<string, Map<string, Severity>>> {
  if (alertIds.length === 0) return new Map();
  const rows: { alert_id: string; rule_code: string; scope_id: string; severity: Severity }[] =
    await em.query(
      `SELECT alert_id, rule_code, scope_id, MAX(severity) AS severity
         FROM rule_triggers WHERE alert_id = ANY($1::uuid[])
        GROUP BY alert_id, rule_code, scope_id`,
      [alertIds],
    );
  const known = new Map<string, Map<string, Severity>>();
  for (const r of rows) {
    const map = known.get(r.alert_id) ?? new Map<string, Severity>();
    map.set(signalKey({ ruleCode: r.rule_code, scopeId: r.scope_id }), r.severity);
    known.set(r.alert_id, map);
  }
  return known;
}

/** Cố vấn học tập hiện tại của lớp sinh viên — suy ra qua lớp (docs/rules/06). */
async function loadClassAdvisors(
  em: EntityManager,
  studentIds: string[],
): Promise<Map<string, string | null>> {
  const rows = await em
    .createQueryBuilder(Student, 's')
    .innerJoin('s.administrativeClass', 'c')
    .select(['s.studentId AS "studentId"', 'c.advisorId AS "advisorId"'])
    .where('s.studentId IN (:...ids)', { ids: studentIds })
    .getRawMany<{ studentId: string; advisorId: string | null }>();
  return new Map(rows.map((r) => [r.studentId, r.advisorId]));
}

/** Áp 1 quyết định lên DB; trả sự kiện cần thông báo (nếu có). */
async function applyDecision(
  em: EntityManager,
  decision: AlertDecision,
  ctx: {
    run: RunInfo;
    now: Date;
    student: StudentRunSignals;
    existing: Alert | null;
    advisorId: string | null;
  },
): Promise<{ alertId: string; event: NotificationEvent | null }> {
  const { run, now, student, existing, advisorId } = ctx;
  const applied = {
    lastDetectedAt: now,
    lastAsOf: run.asOf,
    lastEvaluationRunId: run.id,
    riskScoreLogId: student.riskScoreLogId,
  };
  if (decision.action === 'CREATE') {
    const alertId = randomUUID();
    await em.insert(Alert, {
      alertId,
      studentId: student.studentId,
      termId: run.termId,
      severity: decision.severity,
      status: AlertStatus.OPEN,
      firstDetectedAt: now,
      closedAt: null,
      assignedAdvisorId: advisorId,
      closedReason: null,
      isReferenceOnly: true,
      ...applied,
    });
    await recordAlertTransition(em, {
      alertId,
      from: null,
      to: AlertStatus.OPEN,
      actorId: null,
      reason: null,
      at: now,
    });
    return { alertId, event: decision.event };
  }
  const alert = existing!;
  if (decision.action === 'UPDATE') {
    await em.update(Alert, { alertId: alert.alertId }, { severity: decision.severity, ...applied });
    return { alertId: alert.alertId, event: decision.event };
  }
  if (decision.action === 'REOPEN') {
    await em.update(
      Alert,
      { alertId: alert.alertId },
      {
        severity: decision.severity,
        status: AlertStatus.REOPENED,
        closedAt: null,
        closedReason: null,
        assignedAdvisorId: advisorId,
        ...applied,
      },
    );
    await recordAlertTransition(em, {
      alertId: alert.alertId,
      from: alert.status,
      to: AlertStatus.REOPENED,
      actorId: null,
      reason: 'Xuất hiện dấu hiệu mới hoặc nặng hơn sau khi đã đóng.',
      at: now,
    });
    return { alertId: alert.alertId, event: decision.event };
  }
  return { alertId: alert.alertId, event: null };
}

/**
 * Gộp dấu hiệu của 1 lô sinh viên vào cảnh báo (1 / sinh viên / học kỳ — docs/rules/08 bước 7–9),
 * trong transaction `em` của lô. Luôn `isReferenceOnly = true`.
 */
export async function syncAlertsForChunk(
  em: EntityManager,
  run: RunInfo,
  students: readonly StudentRunSignals[],
): Promise<AlertSyncResult> {
  const result: AlertSyncResult = {
    alertIdByStudent: new Map(),
    created: 0,
    updated: 0,
    events: [],
  };
  const withSignals = students.filter((s) => s.signals.length > 0);
  if (withSignals.length === 0) return result;
  const ids = withSignals.map((s) => s.studentId);
  const [existing, rules, advisors] = await Promise.all([
    em.find(Alert, {
      where: { termId: run.termId, studentId: In(ids), status: Not(AlertStatus.INVALIDATED) },
      lock: { mode: 'pessimistic_write' },
    }),
    em.find(Rule, { select: { ruleCode: true, cooldown: true } }),
    loadClassAdvisors(em, ids),
  ]);
  const alertOf = new Map(existing.map((a) => [a.studentId, a]));
  const known = await loadKnownSignals(
    em,
    existing.map((a) => a.alertId),
  );
  const cooldown = new Map(rules.map((r) => [r.ruleCode, r.cooldown]));
  const now = new Date();

  for (const student of withSignals) {
    const alert = alertOf.get(student.studentId) ?? null;
    const state: ExistingAlertState | null = alert && {
      status: alert.status,
      severity: alert.severity,
      lastAsOf: alert.lastAsOf,
      closedAt: alert.closedAt,
      knownSignals: known.get(alert.alertId) ?? new Map(),
    };
    const cooldownHours = Math.max(0, ...student.signals.map((s) => cooldown.get(s.ruleCode) ?? 0));
    const decision = decideAlertUpdate(state, student.signals, {
      asOf: run.asOf,
      now,
      cooldownHours,
    });
    const advisorId = advisors.get(student.studentId) ?? null;
    const applied = await applyDecision(em, decision, {
      run,
      now,
      student,
      existing: alert,
      advisorId,
    });
    result.alertIdByStudent.set(student.studentId, applied.alertId);
    if (decision.action === 'CREATE') result.created += 1;
    else if (decision.action !== 'EVIDENCE_ONLY') result.updated += 1;
    if (applied.event && decision.action !== 'EVIDENCE_ONLY') {
      result.events.push({
        alertId: applied.alertId,
        event: applied.event,
        severity: decision.severity,
        recipientId:
          decision.action === 'UPDATE' ? (alert?.assignedAdvisorId ?? advisorId) : advisorId,
      });
    }
  }
  return result;
}

/**
 * Sau khi hoàn tác lô (docs/rules/08, 12): cảnh báo đang mở của học kỳ mà sinh viên KHÔNG còn
 * trigger nào ở lần chạy lại → INVALIDATED do hệ thống. Ngoài trường hợp này hệ thống không tự đóng cảnh báo.
 */
export async function invalidateAlertsAfterRollback(
  em: EntityManager,
  run: RunInfo,
): Promise<number> {
  const stale = await em
    .createQueryBuilder(Alert, 'a')
    .where('a.termId = :termId', { termId: run.termId })
    .andWhere('a.status IN (:...open)', { open: OPEN_ALERT_STATUSES })
    .andWhere(
      'NOT EXISTS (SELECT 1 FROM rule_triggers t WHERE t.evaluation_run_id = :runId AND t.student_id = a.student_id)',
      { runId: run.id },
    )
    .setLock('pessimistic_write')
    .getMany();
  const reason = 'Dữ liệu nguồn đã được hoàn tác — không còn dấu hiệu.';
  for (const alert of stale) {
    await em.update(
      Alert,
      { alertId: alert.alertId },
      { status: AlertStatus.INVALIDATED, closedReason: reason, closedAt: new Date() },
    );
    await recordAlertTransition(em, {
      alertId: alert.alertId,
      from: alert.status,
      to: AlertStatus.INVALIDATED,
      actorId: null,
      reason,
    });
  }
  return stale.length;
}
