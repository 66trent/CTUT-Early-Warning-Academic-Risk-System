import { randomUUID } from 'node:crypto';
import { In, Not, type EntityManager } from 'typeorm';
import { Alert } from '@/db/entities/alert.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
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

/** 1 dấu hiệu của lần chạy, kèm id RuleTrigger sẽ ghi (sinh trước để lưu "dấu hiệu hiện tại"). */
export interface RunSignal extends Signal {
  triggerId: string;
}

/** Kết quả đánh giá 1 sinh viên ở 1 lần chạy — đầu vào gộp cảnh báo. */
export interface StudentRunSignals {
  studentId: string;
  riskScoreLogId: string | null;
  signals: RunSignal[];
  /** Học phần có điểm danh quá hạn ở lần chạy này — giữ dấu hiệu điểm danh cũ (docs/rules/08). */
  staleScopes?: string[];
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
  /** Khác NULL = lần chạy chỉ 1 học phần (không được hạ mức — docs/rules/08). */
  courseId: string | null;
  /** Lần chạy lại sau hoàn tác lô: hết dấu hiệu → INVALIDATED thay vì nhãn "không còn dấu hiệu". */
  rollback?: boolean;
}

/** Dấu hiệu dựa trên điểm danh — được giữ khi điểm danh của học phần quá hạn. */
const dependsOnAttendance = (ruleCode: string) =>
  ruleCode.startsWith('ATT-') || ruleCode.startsWith('COMB-');

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

/** Dấu hiệu hiện tại (theo `currentTriggerIds`) của các cảnh báo. */
async function loadCurrentSignals(
  em: EntityManager,
  alerts: readonly Alert[],
): Promise<Map<string, RunSignal[]>> {
  const ids = alerts.flatMap((a) => a.currentTriggerIds);
  if (ids.length === 0) return new Map();
  const triggers = await em.find(RuleTrigger, {
    select: { id: true, alertId: true, ruleCode: true, scopeId: true, severity: true },
    where: { id: In(ids) },
  });
  const byAlert = new Map<string, RunSignal[]>();
  for (const t of triggers) {
    if (!t.alertId) continue;
    byAlert.set(t.alertId, [
      ...(byAlert.get(t.alertId) ?? []),
      { ruleCode: t.ruleCode, scopeId: t.scopeId, severity: t.severity, triggerId: t.id },
    ]);
  }
  return byAlert;
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

/**
 * Dấu hiệu hiện tại MỚI sau lần chạy:
 * - theo học phần: giữ dấu hiệu học phần khác, thay dấu hiệu của học phần đó + cả học kỳ;
 * - cả học kỳ: thay toàn bộ, trừ dấu hiệu điểm danh của học phần có điểm danh quá hạn (giữ lại).
 */
function nextCurrentSignals(
  run: RunInfo,
  student: StudentRunSignals,
  previous: readonly RunSignal[],
): { current: RunSignal[]; carried: RunSignal[] } {
  const fresh = new Set(student.signals.map(signalKey));
  if (run.courseId !== null) {
    const covered = new Set([run.courseId, student.studentId]);
    const kept = previous.filter((s) => !covered.has(s.scopeId) && !fresh.has(signalKey(s)));
    return { current: [...kept, ...student.signals], carried: [] };
  }
  const stale = new Set(student.staleScopes ?? []);
  const carried = previous.filter(
    (s) => dependsOnAttendance(s.ruleCode) && stale.has(s.scopeId) && !fresh.has(signalKey(s)),
  );
  return { current: [...student.signals, ...carried], carried };
}

interface ApplyContext {
  run: RunInfo;
  now: Date;
  student: StudentRunSignals;
  existing: Alert | null;
  advisorId: string | null;
  current: RunSignal[];
}

/** Áp 1 quyết định lên DB; trả sự kiện cần thông báo (nếu có). */
async function applyDecision(
  em: EntityManager,
  decision: AlertDecision,
  ctx: ApplyContext,
): Promise<{ alertId: string; event: NotificationEvent | null }> {
  const { run, now, student, existing, advisorId, current } = ctx;
  // Lần chạy theo học phần (cảnh báo đã có) KHÔNG thay mốc/lần chạy cả học kỳ đã áp dụng.
  const partialUpdate = run.courseId !== null && existing !== null;
  const applied = {
    lastDetectedAt: now,
    ...(partialUpdate
      ? {}
      : {
          lastAsOf: run.asOf,
          lastEvaluationRunId: run.id,
          riskScoreLogId: student.riskScoreLogId,
        }),
    currentTriggerIds: current.map((s) => s.triggerId),
    signalsClearedAt: null,
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
      lastAsOf: run.asOf,
      lastEvaluationRunId: run.id,
      riskScoreLogId: student.riskScoreLogId,
      lastDetectedAt: now,
      currentTriggerIds: current.map((s) => s.triggerId),
      signalsClearedAt: null,
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

/** Cảnh báo đang mở, lần chạy cả học kỳ không còn dấu hiệu nào (kể cả dấu hiệu được giữ). */
async function handleNoSignals(em: EntityManager, run: RunInfo, alert: Alert): Promise<void> {
  if (!OPEN_ALERT_STATUSES.includes(alert.status)) return;
  // Hoàn tác lô: dữ liệu đã bị gỡ — không phụ thuộc mốc asOf (docs/rules/12).
  if (run.rollback) {
    const reason = 'Dữ liệu nguồn đã được hoàn tác — không còn dấu hiệu.';
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
    return;
  }
  // Không tự đóng, không đổi mức; giữ dấu hiệu cuối để Cố vấn học tập xem (docs/rules/08).
  // Lần chạy mốc cũ hơn dữ liệu đã áp dụng → bỏ qua.
  if (run.asOf >= alert.lastAsOf && !alert.signalsClearedAt) {
    await em.update(Alert, { alertId: alert.alertId }, { signalsClearedAt: new Date() });
  }
}

/**
 * Gộp dấu hiệu của 1 lô sinh viên vào cảnh báo (1 / sinh viên / học kỳ — docs/rules/08 bước 7–9),
 * trong transaction `em` của lô. Lần chạy cả học kỳ xét cả sinh viên đang có cảnh báo mở nhưng
 * không còn dấu hiệu. Luôn `isReferenceOnly = true`.
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
  const candidates = run.courseId === null ? students : students.filter((s) => s.signals.length);
  if (candidates.length === 0) return result;
  const ids = candidates.map((s) => s.studentId);
  const [existing, rules, advisors] = await Promise.all([
    em.find(Alert, {
      where: { termId: run.termId, studentId: In(ids), status: Not(AlertStatus.INVALIDATED) },
      lock: { mode: 'pessimistic_write' },
    }),
    em.find(Rule, { select: { ruleCode: true, cooldown: true } }),
    loadClassAdvisors(em, ids),
  ]);
  const alertOf = new Map(existing.map((a) => [a.studentId, a]));
  const [known, previous] = await Promise.all([
    loadKnownSignals(
      em,
      existing.map((a) => a.alertId),
    ),
    loadCurrentSignals(em, existing),
  ]);
  const cooldown = new Map(rules.map((r) => [r.ruleCode, r.cooldown]));
  const now = new Date();

  for (const student of candidates) {
    const alert = alertOf.get(student.studentId) ?? null;
    const { current, carried } = nextCurrentSignals(
      run,
      student,
      alert ? (previous.get(alert.alertId) ?? []) : [],
    );
    if (student.signals.length === 0 && carried.length === 0) {
      if (alert) await handleNoSignals(em, run, alert);
      continue;
    }
    const state: ExistingAlertState | null = alert && {
      status: alert.status,
      severity: alert.severity,
      lastAsOf: alert.lastAsOf,
      closedAt: alert.closedAt,
      knownSignals: known.get(alert.alertId) ?? new Map(),
    };
    const decisionSignals = run.courseId === null ? current : student.signals;
    const cooldownHours = Math.max(0, ...decisionSignals.map((s) => cooldown.get(s.ruleCode) ?? 0));
    const decision = decideAlertUpdate(state, decisionSignals, {
      asOf: run.asOf,
      now,
      cooldownHours,
      partial: run.courseId !== null,
    });
    const advisorId = advisors.get(student.studentId) ?? null;
    const applied = await applyDecision(em, decision, {
      run,
      now,
      student,
      existing: alert,
      advisorId,
      current,
    });
    if (student.signals.length > 0) result.alertIdByStudent.set(student.studentId, applied.alertId);
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
 * Sau khi hoàn tác lô (docs/rules/08, 12): cảnh báo đang mở của sinh viên KHÔNG còn được xét ở
 * lần chạy lại (mọi dữ liệu học kỳ của sinh viên đã bị gỡ) → INVALIDATED. Sinh viên còn được xét
 * thì `syncAlertsForChunk` đã xử lý (kể cả giữ dấu hiệu điểm danh quá hạn).
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
      'NOT EXISTS (SELECT 1 FROM risk_score_logs l WHERE l.evaluation_run_id = :runId AND l.student_id = a.student_id)',
      { runId: run.id },
    )
    .setLock('pessimistic_write')
    .getMany();
  for (const alert of stale) await handleNoSignals(em, { ...run, rollback: true }, alert);
  return stale.length;
}
