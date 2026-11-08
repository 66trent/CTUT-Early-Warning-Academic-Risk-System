import { getDataSource } from '@/db/data-source';
import { AlertStatus, Severity, SEVERITY_ORDER } from '@/db/enums';
import { OVERDUE_DAYS, type SignalSource } from './alert-presentation';

export { OVERDUE_DAYS };

/**
 * Số liệu 2 trang tổng quan (Admin, Cố vấn học tập) — docs/rules/07. Mọi số tổng hợp bằng
 * `COUNT … GROUP BY` ở DB (docs/rules/01, 05), truy vấn tham số dạng mảng `$n` (docs/rules/06).
 * Phạm vi: học kỳ + (khoa của lớp sinh hoạt | lớp do 1 Cố vấn học tập phụ trách — suy ra qua lớp,
 * docs/rules/06).
 */
export interface DashboardScope {
  termId: string;
  departmentId?: string | null;
  /** Ngành của lớp sinh hoạt (docs/rules/09, Phase 9a). */
  majorId?: string | null;
  advisorId?: string | null;
}

const WAITING: AlertStatus[] = [AlertStatus.OPEN, AlertStatus.REOPENED];
const FOLLOWING: AlertStatus[] = [AlertStatus.ACKNOWLEDGED, AlertStatus.IN_PROGRESS];
const DONE: AlertStatus[] = [AlertStatus.RESOLVED, AlertStatus.DISMISSED];
const ACTIVE: AlertStatus[] = [...WAITING, ...FOLLOWING];

/** JOIN + WHERE phạm vi sinh viên (bí danh `s` = students, `c` = lớp), bắt đầu từ $start. */
export function scopeSql(
  scope: DashboardScope,
  start: number,
): { join: string; where: string; args: unknown[] } {
  const args: unknown[] = [];
  const where: string[] = [];
  if (scope.departmentId)
    where.push(`c.department_id = $${start + args.push(scope.departmentId) - 1}`);
  if (scope.majorId) where.push(`c.major_id = $${start + args.push(scope.majorId) - 1}`);
  if (scope.advisorId) where.push(`c.advisor_id = $${start + args.push(scope.advisorId) - 1}`);
  return {
    join: 'JOIN administrative_classes c ON c.class_id = s.class_id',
    where: where.length ? ` AND ${where.join(' AND ')}` : '',
    args,
  };
}

export interface AlertSummaryDto {
  /** Số cảnh báo theo trạng thái (không tính INVALIDATED). */
  waiting: number;
  following: number;
  done: number;
  /** Cảnh báo chưa đóng theo mức — CRITICAL trước. */
  activeBySeverity: { severity: Severity; count: number }[];
  /** Chờ xác nhận quá OVERDUE_DAYS ngày (giờ thật). */
  overdue: number;
  /** Mức rất cao chưa được xác nhận. */
  criticalWaiting: number;
  studentsWithAlerts: number;
  totalStudents: number;
}

/** Tóm tắt cảnh báo của phạm vi. */
export async function getAlertSummary(scope: DashboardScope): Promise<AlertSummaryDto> {
  const ds = await getDataSource();
  const sc = scopeSql(scope, 2);
  const [byStatus, [extra], [students]] = await Promise.all([
    ds.query<{ status: AlertStatus; severity: Severity; n: string }[]>(
      `SELECT a.status, a.severity, COUNT(*) AS n FROM alerts a
       JOIN students s ON s.student_id = a.student_id ${sc.join}
       WHERE a.term_id = $1 AND a.status <> 'INVALIDATED'${sc.where}
       GROUP BY a.status, a.severity`,
      [scope.termId, ...sc.args],
    ),
    ds.query<{ overdue: string; critical: string; students: string }[]>(
      `SELECT
         COUNT(*) FILTER (WHERE a.status IN ('OPEN','REOPENED')
           AND a.first_detected_at < now() - make_interval(days => ${OVERDUE_DAYS})) AS overdue,
         COUNT(*) FILTER (WHERE a.status IN ('OPEN','REOPENED') AND a.severity = 'CRITICAL') AS critical,
         COUNT(DISTINCT a.student_id) FILTER (
           WHERE a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')) AS students
       FROM alerts a JOIN students s ON s.student_id = a.student_id ${sc.join}
       WHERE a.term_id = $1${sc.where}`,
      [scope.termId, ...sc.args],
    ),
    ds.query<{ n: string }[]>(
      `SELECT COUNT(*) AS n FROM students s ${sc.join} WHERE TRUE${scopeSql(scope, 1).where}`,
      scopeSql(scope, 1).args,
    ),
  ]);
  const sum = (statuses: AlertStatus[]) =>
    byStatus.filter((r) => statuses.includes(r.status)).reduce((x, r) => x + Number(r.n), 0);
  return {
    waiting: sum(WAITING),
    following: sum(FOLLOWING),
    done: sum(DONE),
    activeBySeverity: [...SEVERITY_ORDER].reverse().map((severity) => ({
      severity,
      count: byStatus
        .filter((r) => r.severity === severity && ACTIVE.includes(r.status))
        .reduce((x, r) => x + Number(r.n), 0),
    })),
    overdue: Number(extra?.overdue ?? 0),
    criticalWaiting: Number(extra?.critical ?? 0),
    studentsWithAlerts: Number(extra?.students ?? 0),
    totalStudents: Number(students?.n ?? 0),
  };
}

export interface RunTrendPointDto {
  runId: string;
  asOf: string;
  /** Số sinh viên có dấu hiệu theo mức cao nhất của sinh viên ở lần chạy đó. */
  bySeverity: Record<Severity, number>;
  studentsWithSignals: number;
  insufficient: number;
}

/**
 * Diễn biến qua các lần đánh giá cả học kỳ đã xong (người dùng chốt: trục = mốc dữ liệu, không
 * theo tuần lịch). Cùng 1 ngày mốc chạy nhiều lần → lấy lần mới nhất. Tối đa `limit` mốc gần nhất.
 */
export async function getRunTrend(scope: DashboardScope, limit = 8): Promise<RunTrendPointDto[]> {
  const ds = await getDataSource();
  const runs = await ds.query<{ id: string; as_of: Date }[]>(
    `SELECT id, as_of FROM (
       SELECT DISTINCT ON (as_of::date) id, as_of, created_at FROM evaluation_runs
       WHERE term_id = $1 AND course_id IS NULL AND status = 'COMPLETED'
       ORDER BY as_of::date, created_at DESC
     ) r ORDER BY as_of DESC LIMIT $2`,
    [scope.termId, limit],
  );
  if (runs.length === 0) return [];
  const ids = runs.map((r) => r.id);
  const sc = scopeSql(scope, 2);
  const [severityRows, insufficientRows] = await Promise.all([
    ds.query<{ run_id: string; sev: Severity; n: string }[]>(
      `SELECT x.run_id, x.sev, COUNT(*) AS n FROM (
         SELECT t.evaluation_run_id AS run_id, t.student_id, MAX(t.severity) AS sev
         FROM rule_triggers t JOIN students s ON s.student_id = t.student_id ${sc.join}
         WHERE t.evaluation_run_id = ANY($1)${sc.where}
         GROUP BY t.evaluation_run_id, t.student_id
       ) x GROUP BY x.run_id, x.sev`,
      [ids, ...sc.args],
    ),
    ds.query<{ run_id: string; n: string }[]>(
      `SELECT l.evaluation_run_id AS run_id, COUNT(*) AS n FROM risk_score_logs l
       JOIN students s ON s.student_id = l.student_id ${sc.join}
       WHERE l.evaluation_run_id = ANY($1) AND l.data_completeness_level = 'INSUFFICIENT'${sc.where}
       GROUP BY l.evaluation_run_id`,
      [ids, ...sc.args],
    ),
  ]);
  const insufficient = new Map(insufficientRows.map((r) => [r.run_id, Number(r.n)]));
  return runs
    .map((run) => {
      const bySeverity = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<
        Severity,
        number
      >;
      for (const r of severityRows) if (r.run_id === run.id) bySeverity[r.sev] = Number(r.n);
      return {
        runId: run.id,
        asOf: new Date(run.as_of).toISOString(),
        bySeverity,
        studentsWithSignals: Object.values(bySeverity).reduce((x, y) => x + y, 0),
        insufficient: insufficient.get(run.id) ?? 0,
      };
    })
    .reverse();
}

/** Sinh viên có cảnh báo chưa đóng theo nguồn dấu hiệu hiện tại (1 sinh viên đếm ở nhiều nguồn). */
export async function getSourceBreakdown(
  scope: DashboardScope,
): Promise<{ source: SignalSource; students: number }[]> {
  const ds = await getDataSource();
  const sc = scopeSql(scope, 2);
  const rows = await ds.query<{ source: SignalSource; n: string }[]>(
    `SELECT CASE
        WHEN t.rule_code LIKE 'ATT%' THEN 'ATTENDANCE'
        WHEN t.rule_code LIKE 'LMS%' THEN 'LMS'
        WHEN t.rule_code LIKE 'ACA%' THEN 'ACADEMIC'
        ELSE 'COMBINED' END AS source,
       COUNT(DISTINCT a.student_id) AS n
     FROM alerts a JOIN students s ON s.student_id = a.student_id ${sc.join}
     JOIN rule_triggers t ON t.id = ANY(a.current_trigger_ids)
     WHERE a.term_id = $1 AND a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')${sc.where}
     GROUP BY 1`,
    [scope.termId, ...sc.args],
  );
  const order: SignalSource[] = ['ATTENDANCE', 'LMS', 'ACADEMIC', 'COMBINED'];
  return order.map((source) => ({
    source,
    students: Number(rows.find((r) => r.source === source)?.n ?? 0),
  }));
}

export interface TopCourseDto {
  courseId: string;
  courseName: string;
  students: number;
}

/** Học phần có nhiều sinh viên mang dấu hiệu (cảnh báo chưa đóng) nhất. */
export async function getTopCourses(scope: DashboardScope, limit = 5): Promise<TopCourseDto[]> {
  const ds = await getDataSource();
  const sc = scopeSql(scope, 3);
  const rows = await ds.query<{ course_id: string; course_name: string | null; n: string }[]>(
    `SELECT t.scope_id AS course_id, co.course_name, COUNT(DISTINCT a.student_id) AS n
     FROM alerts a JOIN students s ON s.student_id = a.student_id ${sc.join}
     JOIN rule_triggers t ON t.id = ANY(a.current_trigger_ids)
     LEFT JOIN courses co ON co.course_id = t.scope_id
     WHERE a.term_id = $1 AND t.scope_id <> t.student_id
       AND a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')${sc.where}
     GROUP BY t.scope_id, co.course_name ORDER BY n DESC, t.scope_id LIMIT $2`,
    [scope.termId, limit, ...sc.args],
  );
  return rows.map((r) => ({
    courseId: r.course_id,
    courseName: r.course_name ?? r.course_id,
    students: Number(r.n),
  }));
}

export interface ClassSeverityRowDto {
  classId: string;
  bySeverity: Record<Severity, number>;
  total: number;
}

/** Cảnh báo chưa đóng theo lớp × mức — `limit` lớp nhiều cảnh báo nhất. */
export async function getClassSeverity(
  scope: DashboardScope,
  limit = 10,
): Promise<{ rows: ClassSeverityRowDto[]; totalClasses: number }> {
  const ds = await getDataSource();
  const sc = scopeSql(scope, 2);
  const rows = await ds.query<{ class_id: string; severity: Severity; n: string }[]>(
    `SELECT s.class_id, a.severity, COUNT(*) AS n
     FROM alerts a JOIN students s ON s.student_id = a.student_id ${sc.join}
     WHERE a.term_id = $1 AND a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')${sc.where}
     GROUP BY s.class_id, a.severity`,
    [scope.termId, ...sc.args],
  );
  const byClass = new Map<string, ClassSeverityRowDto>();
  for (const r of rows) {
    const row = byClass.get(r.class_id) ?? {
      classId: r.class_id,
      bySeverity: Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<Severity, number>,
      total: 0,
    };
    row.bySeverity[r.severity] = Number(r.n);
    row.total += Number(r.n);
    byClass.set(r.class_id, row);
  }
  const sorted = [...byClass.values()].sort(
    (a, b) =>
      b.bySeverity.CRITICAL - a.bySeverity.CRITICAL ||
      b.total - a.total ||
      a.classId.localeCompare(b.classId),
  );
  return { rows: sorted.slice(0, limit), totalClasses: sorted.length };
}

export interface LastRunDto {
  id: string;
  asOf: string;
  finishedAt: string | null;
}

/** Lần chạy đánh giá cả học kỳ gần nhất đã xong. */
export async function getLastRun(termId: string): Promise<LastRunDto | null> {
  const ds = await getDataSource();
  const [row] = await ds.query<{ id: string; as_of: Date; finished_at: Date | null }[]>(
    `SELECT id, as_of, finished_at FROM evaluation_runs
     WHERE term_id = $1 AND course_id IS NULL AND status = 'COMPLETED'
     ORDER BY created_at DESC LIMIT 1`,
    [termId],
  );
  return row
    ? {
        id: row.id,
        asOf: new Date(row.as_of).toISOString(),
        finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
      }
    : null;
}
