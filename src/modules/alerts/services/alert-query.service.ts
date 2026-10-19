import { In } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { AlertStateHistory } from '@/db/entities/alert-state-history.entity';
import { Alert } from '@/db/entities/alert.entity';
import { Course } from '@/db/entities/course.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { Intervention } from '@/db/entities/intervention.entity';
import { RiskScoreLog } from '@/db/entities/risk-score-log.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { Rule } from '@/db/entities/rule.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import {
  AlertStatus,
  ConfidentialityLevel,
  type DataCompletenessLevel,
  type InterventionType,
  OPEN_ALERT_STATUSES,
  type Severity,
  SEVERITY_ORDER,
} from '@/db/enums';
import { applyOrder, firstPage, type ListParams, type Paged, pageOffset } from '@/lib/list-params';
import { ADVISOR_TRANSITIONS } from './alert-lifecycle.service';
import { loadCurrentTriggers } from './current-signals';
import {
  evidenceRows,
  SOURCE_INLINE_LABELS,
  SOURCE_LABELS,
  sourceOf,
  type SignalSource,
} from './alert-presentation';

export interface AlertListItemDto {
  alertId: string;
  studentId: string;
  studentName: string;
  classId: string;
  termId: string;
  termName: string;
  severity: Severity;
  status: AlertStatus;
  /** VD "3 nguyên nhân: điểm danh, bài kiểm tra LMS, kết quả học tập". */
  summary: string;
  signalCount: number;
  lastDetectedAt: string;
  /** Lần đánh giá cả học kỳ gần nhất không còn dấu hiệu (cảnh báo vẫn mở) — docs/rules/08. */
  signalsClearedAt: string | null;
  advisorName: string | null;
}

export interface AlertSignalDto {
  triggerId: string;
  ruleCode: string;
  ruleName: string;
  courseLabel: string;
  severity: Severity;
  reason: string;
  /** Ngày số liệu (ngày chốt / ngày công bố / mốc chạy), dạng ISO. */
  dataDate: string;
}

export interface AlertDetailDto extends AlertListItemDto {
  closedReason: string | null;
  firstDetectedAt: string;
  isReferenceOnly: boolean;
  riskScore: { value: number | null; level: DataCompletenessLevel } | null;
  groups: { source: SignalSource; label: string; signals: AlertSignalDto[] }[];
  interventions: {
    interventionId: string;
    type: InterventionType;
    performedBy: string;
    performedAt: string;
    status: string;
    sensitive: boolean;
    /** NULL khi SENSITIVE và người xem không phải Cố vấn học tập phụ trách (docs/rules/04). */
    content: string | null;
    outcome: string | null;
    nextFollowUpAt: string | null;
  }[];
  history: {
    fromStatus: AlertStatus | null;
    toStatus: AlertStatus;
    changedBy: string | null;
    reason: string | null;
    changedAt: string;
  }[];
  allowedTransitions: AlertStatus[];
}

const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);

/** Dấu hiệu hiện tại của cảnh báo — xem `loadCurrentTriggers`. */
async function currentTriggers(alerts: Alert[]): Promise<Map<string, RuleTrigger[]>> {
  return loadCurrentTriggers((await getDataSource()).manager, alerts);
}

function summarize(triggers: readonly RuleTrigger[]): string {
  const sources = [...new Set(triggers.map((t) => sourceOf(t.ruleCode)))];
  if (sources.length === 0) return 'Chưa có dấu hiệu ở lần đánh giá gần nhất';
  return `${triggers.length} nguyên nhân: ${sources.map((s) => SOURCE_INLINE_LABELS[s]).join(', ')}`;
}

/** `keepOrder`: giữ thứ tự truy vấn (đã sắp xếp + phân trang ở DB). */
async function toListItems(alerts: Alert[], keepOrder = false): Promise<AlertListItemDto[]> {
  if (alerts.length === 0) return [];
  const ds = await getDataSource();
  const [students, terms, triggers] = await Promise.all([
    ds.getRepository(Student).find({
      where: { studentId: In([...new Set(alerts.map((a) => a.studentId))]) },
      relations: { administrativeClass: true },
    }),
    ds.getRepository(Term).find({ select: { termId: true, termName: true } }),
    currentTriggers(alerts),
  ]);
  const advisorIds = [...new Set(students.map((s) => s.administrativeClass?.advisorId ?? ''))];
  const advisors = await ds
    .getRepository(User)
    .find({ select: { userId: true, fullName: true }, where: { userId: In(advisorIds) } });
  const studentOf = new Map(students.map((s) => [s.studentId, s]));
  const termName = new Map(terms.map((t) => [t.termId, t.termName]));
  const advisorName = new Map(advisors.map((a) => [a.userId, a.fullName]));
  const items = alerts.map((a): AlertListItemDto => {
    const s = studentOf.get(a.studentId);
    const ts = triggers.get(a.alertId) ?? [];
    return {
      alertId: a.alertId,
      studentId: a.studentId,
      studentName: s?.fullName ?? a.studentId,
      classId: s?.classId ?? '',
      termId: a.termId,
      termName: termName.get(a.termId) ?? a.termId,
      severity: a.severity,
      status: a.status,
      summary: summarize(ts),
      signalCount: ts.length,
      lastDetectedAt: a.lastDetectedAt.toISOString(),
      signalsClearedAt: a.signalsClearedAt?.toISOString() ?? null,
      advisorName: advisorName.get(s?.administrativeClass?.advisorId ?? '') ?? null,
    };
  });
  if (keepOrder) return items;
  return items.sort(
    (x, y) =>
      rank(y.severity) - rank(x.severity) ||
      y.lastDetectedAt.localeCompare(x.lastDetectedAt) ||
      x.studentId.localeCompare(y.studentId),
  );
}

export const ALERT_SORT_KEYS = [
  'severity',
  'studentId',
  'classId',
  'status',
  'lastDetectedAt',
] as const;
export type AlertSortKey = (typeof ALERT_SORT_KEYS)[number];
export const ALERT_DEFAULT_SORT = { sort: 'severity', dir: 'desc' } as const;
const ALERT_SORT_COLUMNS: Record<AlertSortKey, string> = {
  severity: 'a.severity',
  studentId: 'a.studentId',
  classId: 's.classId',
  status: 'a.status',
  lastDetectedAt: 'a.lastDetectedAt',
};

export type AlertListScope = 'TODO' | 'ALL';

/**
 * Danh sách cảnh báo của Cố vấn học tập — phạm vi SUY RA QUA LỚP (`advisorId` của lớp hiện tại,
 * docs/rules/06), không dựa vào `assignedAdvisorId`. Sắp Severity giảm dần (CRITICAL trên cùng).
 */
export async function listAdvisorAlerts(
  advisorId: string,
  termId: string,
  scope: AlertListScope,
): Promise<AlertListItemDto[]> {
  const qb = (await getDataSource())
    .getRepository(Alert)
    .createQueryBuilder('a')
    .innerJoin(Student, 's', 's.studentId = a.studentId')
    .innerJoin(AdministrativeClass, 'c', 'c.classId = s.classId')
    .where('c.advisorId = :advisorId', { advisorId })
    .andWhere('a.termId = :termId', { termId });
  if (scope === 'TODO') qb.andWhere('a.status IN (:...open)', { open: OPEN_ALERT_STATUSES });
  else qb.andWhere('a.status <> :invalid', { invalid: AlertStatus.INVALIDATED });
  return toListItems(await qb.take(500).getMany());
}

/**
 * Admin — chỉ đọc. `NO_ADVISOR`: cảnh báo của lớp chưa có Cố vấn học tập phụ trách.
 * `departmentId`: lọc theo khoa của lớp sinh hoạt (docs/rules/07).
 */
export async function listAdminAlerts(
  termId: string,
  filter: 'ALL' | 'NO_ADVISOR',
  departmentId: string | null = null,
  list: ListParams<AlertSortKey> = firstPage(ALERT_DEFAULT_SORT),
): Promise<Paged<AlertListItemDto>> {
  const qb = (await getDataSource())
    .getRepository(Alert)
    .createQueryBuilder('a')
    .innerJoin(Student, 's', 's.studentId = a.studentId')
    .innerJoin(AdministrativeClass, 'c', 'c.classId = s.classId')
    .where('a.termId = :termId', { termId });
  if (departmentId) qb.andWhere('c.departmentId = :departmentId', { departmentId });
  if (filter === 'NO_ADVISOR') {
    qb.andWhere('c.advisorId IS NULL').andWhere('a.status IN (:...open)', {
      open: OPEN_ALERT_STATUSES,
    });
  }
  // Enum `severity` của Postgres sắp theo thứ tự khai báo LOW < … < CRITICAL.
  applyOrder(
    qb,
    ALERT_SORT_COLUMNS[list.sort ?? 'severity'],
    list.dir,
    ['a.lastDetectedAt', 'DESC'],
    ['a.studentId', 'ASC'],
  );
  qb
    // Join 1–1 (sinh viên, lớp) không nhân dòng → offset/limit thẳng, tránh truy vấn con của skip/take.
    .offset(pageOffset(list))
    .limit(list.size);
  const [alerts, total] = await qb.getManyAndCount();
  return { items: await toListItems(alerts, true), total, page: list.page, size: list.size };
}

/** Nhóm dấu hiệu theo 3 nguồn kèm số liệu và ngày dữ liệu (docs/rules/07). */
async function signalGroups(
  alert: Alert,
  triggers: RuleTrigger[],
): Promise<AlertDetailDto['groups']> {
  const ds = await getDataSource();
  const [rules, courses, run] = await Promise.all([
    ds.getRepository(Rule).find({ select: { ruleCode: true, ruleName: true } }),
    ds.getRepository(Course).find({
      select: { courseId: true, courseName: true },
      where: { courseId: In(triggers.map((t) => t.scopeId)) },
    }),
    ds.getRepository(EvaluationRun).findOneBy({ id: alert.lastEvaluationRunId }),
  ]);
  const ruleName = new Map(rules.map((r) => [r.ruleCode, r.ruleName]));
  const courseName = new Map(courses.map((c) => [c.courseId, c.courseName]));
  const groups = new Map<SignalSource, AlertSignalDto[]>();
  for (const t of [...triggers].sort((a, b) => rank(b.severity) - rank(a.severity))) {
    const source = sourceOf(t.ruleCode);
    const snapshotDate =
      t.inputSnapshot.snapshotDate ?? t.inputSnapshot.latestDate ?? t.inputSnapshot.publishedAt;
    groups.set(source, [
      ...(groups.get(source) ?? []),
      {
        triggerId: t.id,
        ruleCode: t.ruleCode,
        ruleName: ruleName.get(t.ruleCode) ?? t.ruleCode,
        courseLabel:
          t.scopeId === alert.studentId
            ? 'Cả học kỳ'
            : `${courseName.get(t.scopeId) ?? t.scopeId} (${t.scopeId})`,
        severity: t.severity,
        reason: t.reason,
        dataDate: typeof snapshotDate === 'string' ? snapshotDate : (run?.asOf.toISOString() ?? ''),
      },
    ]);
  }
  return [...groups].map(([source, signals]) => ({
    source,
    label: SOURCE_LABELS[source],
    signals,
  }));
}

/**
 * Chi tiết 1 cảnh báo — gọi SAU assertScope(READ). `canProcess` = Cố vấn học tập phụ trách
 * (Admin xem chỉ đọc); nội dung can thiệp SENSITIVE chỉ hiện cho Cố vấn học tập phụ trách.
 */
export async function getAlertDetail(
  alertId: string,
  viewer: { canProcess: boolean },
): Promise<AlertDetailDto | null> {
  const ds = await getDataSource();
  const alert = await ds.getRepository(Alert).findOneBy({ alertId });
  if (!alert) return null;
  const [[item], triggers, interventions, history, risk] = await Promise.all([
    toListItems([alert]),
    currentTriggers([alert]),
    ds.getRepository(Intervention).find({ where: { alertId }, order: { performedAt: 'DESC' } }),
    ds.getRepository(AlertStateHistory).find({ where: { alertId }, order: { changedAt: 'DESC' } }),
    alert.riskScoreLogId
      ? ds.getRepository(RiskScoreLog).findOneBy({ id: alert.riskScoreLogId })
      : Promise.resolve(null),
  ]);
  if (!item) return null;
  return {
    ...item,
    closedReason: alert.closedReason,
    firstDetectedAt: alert.firstDetectedAt.toISOString(),
    isReferenceOnly: alert.isReferenceOnly,
    riskScore: risk ? { value: risk.riskScoreValue, level: risk.dataCompletenessLevel } : null,
    groups: await signalGroups(alert, triggers.get(alertId) ?? []),
    interventions: interventions.map((i) => {
      const sensitive = i.confidentialityLevel === ConfidentialityLevel.SENSITIVE;
      return {
        interventionId: i.interventionId,
        type: i.type,
        performedBy: i.performedBy,
        performedAt: i.performedAt.toISOString(),
        status: i.status,
        sensitive,
        content: sensitive && !viewer.canProcess ? null : i.content,
        outcome: sensitive && !viewer.canProcess ? null : i.outcome,
        nextFollowUpAt: i.nextFollowUpAt?.toISOString() ?? null,
      };
    }),
    history: history.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedBy: h.changedBy,
      reason: h.reason,
      changedAt: h.changedAt.toISOString(),
    })),
    allowedTransitions: viewer.canProcess ? [...ADVISOR_TRANSITIONS[alert.status]] : [],
  };
}

/** Bằng chứng chi tiết của 1 trigger — chỉ tải khi mở Accordion (docs/rules/05). */
export async function getTriggerEvidence(
  triggerId: string,
): Promise<{ studentId: string; rows: { label: string; value: string }[] } | null> {
  const trigger = await (
    await getDataSource()
  )
    .getRepository(RuleTrigger)
    .findOneBy({ id: triggerId });
  if (!trigger) return null;
  return { studentId: trigger.studentId, rows: evidenceRows(trigger.inputSnapshot) };
}

/** Mã sinh viên của cảnh báo — để Server Action gọi assertScope trước khi đọc/ghi. */
export async function alertOwner(alertId: string): Promise<string | null> {
  const alert = await (
    await getDataSource()
  )
    .getRepository(Alert)
    .findOne({ select: { studentId: true }, where: { alertId } });
  return alert?.studentId ?? null;
}
