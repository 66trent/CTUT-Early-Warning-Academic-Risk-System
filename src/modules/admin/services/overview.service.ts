import { getDataSource } from '@/db/data-source';
import { AlertStatus } from '@/db/enums';
import {
  type AlertSummaryDto,
  type ClassSeverityRowDto,
  type DashboardScope,
  getAlertSummary,
  getClassSeverity,
  getLastRun,
  getRunTrend,
  getSourceBreakdown,
  getTopCourses,
  type LastRunDto,
  type RunTrendPointDto,
  scopeSql,
  type TopCourseDto,
} from '@/modules/alerts/services/dashboard.service';
import type { SignalSource } from '@/modules/alerts/services/alert-presentation';
import { getSetupSteps } from './getting-started.service';

/** Cảnh báo còn cần Cố vấn học tập theo dõi (chưa đóng). */
export const ACTIVE_ALERT_STATUSES: readonly AlertStatus[] = [
  AlertStatus.OPEN,
  AlertStatus.REOPENED,
  AlertStatus.ACKNOWLEDGED,
  AlertStatus.IN_PROGRESS,
];

/** Học phần "cũ dữ liệu": ngày dữ liệu mới nhất trễ hơn ngày mới nhất của học kỳ quá số ngày này. */
export const STALE_DAYS = 7;
/** Lô nhập có tỷ lệ dòng lỗi trên ngưỡng này được nhắc (cùng ngưỡng màn xem trước, docs/rules/12). */
const HIGH_ERROR_RATE = 0.1;
const RECENT_BATCHES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type FreshnessSource = 'ATTENDANCE' | 'LMS_QUIZ' | 'LMS_ASSIGNMENT' | 'COURSE_RESULT';

export interface SourceFreshnessDto {
  source: FreshnessSource;
  /** Ngày dữ liệu mới nhất của nguồn trong học kỳ (null = chưa có dữ liệu). */
  latest: string | null;
  coursesWithData: number;
  /** Học phần có dữ liệu nhưng trễ hơn ngày mới nhất quá STALE_DAYS ngày. */
  stale: { courseId: string; courseName: string; latest: string }[];
  /** Học phần chưa có dữ liệu nguồn này (LMS: có thể là học phần không dùng LMS). */
  missing: { courseId: string; courseName: string }[];
}

/** Độ mới 1 nguồn của 1 học phần (bảng ở trang Nhập dữ liệu — Phase 8f). */
export interface CourseSourceFreshnessDto {
  /** Ngày dữ liệu mới nhất của học phần ở nguồn này (null = chưa có). */
  latest: string | null;
  /** Trễ hơn ngày mới nhất của nguồn trong học kỳ quá STALE_DAYS ngày. */
  stale: boolean;
}

export interface CourseFreshnessDto {
  courseId: string;
  courseName: string;
  sources: Record<FreshnessSource, CourseSourceFreshnessDto>;
  /** Cần nhắc: điểm danh chậm / chưa có, hoặc LMS chậm (cùng tiêu chí `countStaleCourses`). */
  needsAttention: boolean;
}

export interface DataFreshnessDto {
  totalCourses: number;
  sources: SourceFreshnessDto[];
  /** Từng học phần × 4 nguồn. */
  courses: CourseFreshnessDto[];
}

export interface AdminOverviewDto {
  lastRun: LastRunDto | null;
  summary: AlertSummaryDto;
  trend: RunTrendPointDto[];
  sources: { source: SignalSource; students: number }[];
  topCourses: TopCourseDto[];
  classSeverity: { rows: ClassSeverityRowDto[]; totalClasses: number };
  freshness: DataFreshnessDto;
  /** Dải "Cần chú ý" — mục 0 thì trang không hiện. */
  attention: {
    criticalWaiting: number;
    overdue: number;
    staleCourses: number;
    highErrorBatches: number;
    classesWithoutAdvisor: number;
  };
  /** Còn bước thiết lập ban đầu chưa xong (trang Bắt đầu) — null khi đã xong. */
  setup: { done: number; total: number; nextTitle: string | null } | null;
}

const FRESHNESS_SQL: Record<FreshnessSource, string> = {
  ATTENDANCE: `SELECT e.course_id, MAX(x.snapshot_date) AS d FROM attendance_summaries x
    JOIN enrollments e ON e.enrollment_id = x.enrollment_id`,
  LMS_QUIZ: `SELECT e.course_id, MAX(x.started_at) AS d FROM lms_quiz_attempts x
    JOIN enrollments e ON e.enrollment_id = x.enrollment_id`,
  LMS_ASSIGNMENT: `SELECT e.course_id, COALESCE(MAX(act.due_at), MAX(x.submitted_at)) AS d
    FROM lms_assignment_submissions x JOIN lms_activities act ON act.id = x.activity_id
    JOIN enrollments e ON e.enrollment_id = x.enrollment_id`,
  COURSE_RESULT: `SELECT e.course_id, MAX(x.published_at) AS d FROM course_results x
    JOIN enrollments e ON e.enrollment_id = x.enrollment_id`,
};

/**
 * Độ mới dữ liệu 4 nguồn theo học phần (người dùng chốt: so với ngày dữ liệu mới nhất của học kỳ,
 * KHÔNG so với hôm nay). Học phần của học kỳ = học phần có sinh viên trong phạm vi.
 */
export async function getDataFreshness(scope: DashboardScope): Promise<DataFreshnessDto> {
  const ds = await getDataSource();
  const sc = scopeSql(scope, 2);
  const studentJoin = `JOIN students s ON s.student_id = e.student_id ${sc.join}`;
  const where = `WHERE e.term_id = $1${sc.where}`;
  const courses = await ds.query<{ course_id: string; course_name: string | null }[]>(
    `SELECT DISTINCT e.course_id, co.course_name FROM enrollments e ${studentJoin}
     LEFT JOIN courses co ON co.course_id = e.course_id ${where} ORDER BY e.course_id`,
    [scope.termId, ...sc.args],
  );
  const name = new Map(courses.map((c) => [c.course_id, c.course_name ?? c.course_id]));
  const order: FreshnessSource[] = ['ATTENDANCE', 'LMS_QUIZ', 'LMS_ASSIGNMENT', 'COURSE_RESULT'];
  const perSource = await Promise.all(
    order.map((source) =>
      ds.query<{ course_id: string; d: Date }[]>(
        `${FRESHNESS_SQL[source]} ${studentJoin} ${where} GROUP BY e.course_id`,
        [scope.termId, ...sc.args],
      ),
    ),
  );
  const dates = order.map(
    (_, i) => new Map((perSource[i] ?? []).map((r) => [r.course_id, new Date(r.d).getTime()])),
  );
  const latestOf = (m: Map<string, number>) => (m.size ? Math.max(...m.values()) : null);
  const isStale = (source: FreshnessSource, latest: number | null, d: number) =>
    source !== 'COURSE_RESULT' && latest !== null && latest - d > STALE_DAYS * DAY_MS;
  const sources = order.map((source, i): SourceFreshnessDto => {
    const byCourse = dates[i] ?? new Map<string, number>();
    const latest = latestOf(byCourse);
    return {
      source,
      latest: latest === null ? null : new Date(latest).toISOString(),
      coursesWithData: byCourse.size,
      stale: [...byCourse.entries()]
        .filter(([, d]) => isStale(source, latest, d))
        .map(([courseId, d]) => ({
          courseId,
          courseName: name.get(courseId) ?? courseId,
          latest: new Date(d).toISOString(),
        })),
      missing: courses
        .filter((c) => !byCourse.has(c.course_id))
        .map((c) => ({ courseId: c.course_id, courseName: name.get(c.course_id) ?? '' })),
    };
  });
  const perCourse = courses.map((c): CourseFreshnessDto => {
    const cells = order.map((source, i): [FreshnessSource, CourseSourceFreshnessDto] => {
      const byCourse = dates[i] ?? new Map<string, number>();
      const d = byCourse.get(c.course_id);
      return [
        source,
        d === undefined
          ? { latest: null, stale: false }
          : { latest: new Date(d).toISOString(), stale: isStale(source, latestOf(byCourse), d) },
      ];
    });
    const s = Object.fromEntries(cells) as Record<FreshnessSource, CourseSourceFreshnessDto>;
    return {
      courseId: c.course_id,
      courseName: name.get(c.course_id) ?? c.course_id,
      sources: s,
      needsAttention:
        s.ATTENDANCE.stale || !s.ATTENDANCE.latest || s.LMS_QUIZ.stale || s.LMS_ASSIGNMENT.stale,
    };
  });
  return { totalCourses: courses.length, sources, courses: perCourse };
}

/** Học phần cần nhắc: điểm danh cũ hoặc chưa có + LMS cũ (LMS chưa có có thể là không dùng LMS). */
export function countStaleCourses(f: DataFreshnessDto): number {
  const ids = new Set<string>();
  for (const s of f.sources) {
    if (s.source === 'COURSE_RESULT') continue;
    for (const c of s.stale) ids.add(c.courseId);
    if (s.source === 'ATTENDANCE') for (const c of s.missing) ids.add(c.courseId);
  }
  return ids.size;
}

async function countHighErrorBatches(termId: string): Promise<number> {
  const ds = await getDataSource();
  const [row] = await ds.query<{ n: string }[]>(
    `SELECT COUNT(*) AS n FROM (
       SELECT total_rows, error_rows FROM import_batches
       WHERE (term_id = $1 OR term_id IS NULL)
         AND status IN ('STAGED','LOADED','RECONCILED')
       ORDER BY created_at DESC LIMIT $2
     ) b WHERE b.total_rows > 0 AND b.error_rows::float / b.total_rows > $3`,
    [termId, RECENT_BATCHES, HIGH_ERROR_RATE],
  );
  return Number(row?.n ?? 0);
}

async function countClassesWithoutAdvisor(departmentId: string | null): Promise<number> {
  const ds = await getDataSource();
  const [row] = await ds.query<{ n: string }[]>(
    `SELECT COUNT(*) AS n FROM administrative_classes
     WHERE advisor_id IS NULL AND ($1::text IS NULL OR department_id = $1)`,
    [departmentId],
  );
  return Number(row?.n ?? 0);
}

async function setupProgress(): Promise<AdminOverviewDto['setup']> {
  const steps = await getSetupSteps();
  const foundation = steps.filter((s) => s.phase === 'FOUNDATION' || s.phase === 'TERM');
  if (foundation.every((s) => s.done)) return null;
  return {
    done: foundation.filter((s) => s.done).length,
    total: foundation.length,
    nextTitle: steps.find((s) => s.next)?.title ?? null,
  };
}

/** Số liệu trang Tổng quan Admin cho 1 học kỳ (+ khoa) — chỉ số tổng hợp (docs/rules/05, 07). */
export async function getAdminOverview(
  termId: string,
  departmentId: string | null = null,
): Promise<AdminOverviewDto> {
  const scope: DashboardScope = { termId, departmentId };
  const [
    lastRun,
    summary,
    trend,
    sources,
    topCourses,
    classSeverity,
    freshness,
    highErrorBatches,
    classesWithoutAdvisor,
    setup,
  ] = await Promise.all([
    getLastRun(termId),
    getAlertSummary(scope),
    getRunTrend(scope),
    getSourceBreakdown(scope),
    getTopCourses(scope),
    getClassSeverity(scope),
    getDataFreshness(scope),
    countHighErrorBatches(termId),
    countClassesWithoutAdvisor(departmentId),
    setupProgress(),
  ]);
  return {
    lastRun,
    summary,
    trend,
    sources,
    topCourses,
    classSeverity,
    freshness,
    attention: {
      criticalWaiting: summary.criticalWaiting,
      overdue: summary.overdue,
      staleCourses: countStaleCourses(freshness),
      highErrorBatches,
      classesWithoutAdvisor,
    },
    setup,
  };
}
