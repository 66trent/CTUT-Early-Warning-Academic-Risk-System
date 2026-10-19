import { getDataSource } from '@/db/data-source';
import {
  type AlertStatus,
  type InterventionType,
  OPEN_ALERT_STATUSES,
  type Severity,
  SEVERITY_ORDER,
} from '@/db/enums';
import {
  type AttendanceThresholdDto,
  getAttendanceThreshold,
  getStudentTermGpas,
  type TermGpaDto,
} from '@/modules/rule-engine/services/student-academic.service';
import { type SignalSource, sourceOf } from './alert-presentation';

/**
 * Phần "nhìn nhanh" của hồ sơ sinh viên (Cố vấn học tập, Admin — docs/rules/07): mức theo nguồn,
 * diễn biến tỷ lệ vắng, ĐTB các học kỳ, dòng thời gian. GỌI SAU assertScope ở trang.
 */

export interface AttendanceSeriesDto {
  courseId: string;
  courseName: string;
  /** Tỷ lệ vắng (%) tại từng ngày chốt — cùng cách tính với ATT-01 (có phép theo cấu hình). */
  points: { date: string; rate: number }[];
}

export type TimelineEventDto =
  | { kind: 'ALERT_DETECTED'; at: string; severity: Severity }
  | { kind: 'ALERT_STATUS'; at: string; toStatus: AlertStatus }
  | { kind: 'INTERVENTION'; at: string; interventionType: InterventionType; followUp: boolean }
  | { kind: 'ATTENDANCE'; at: string; courseName: string; absences: number; totalPeriods: number }
  | { kind: 'RESULT'; at: string; courseName: string; letterGrade: string; passed: boolean };

export interface StudentInsightsDto {
  /** Mức nặng nhất theo nguồn trong dấu hiệu hiện tại của cảnh báo chưa đóng (null = không có). */
  sources: { source: SignalSource; severity: Severity | null }[];
  threshold: AttendanceThresholdDto | null;
  attendance: AttendanceSeriesDto[];
  gpas: TermGpaDto[];
  timeline: TimelineEventDto[];
}

const SOURCES: SignalSource[] = ['ATTENDANCE', 'LMS', 'ACADEMIC', 'COMBINED'];
const TIMELINE_LIMIT = 30;
const rank = (s: Severity | null) => (s ? SEVERITY_ORDER.indexOf(s) : -1);
const iso = (d: Date | string) => new Date(d).toISOString();

async function sourceLevels(studentId: string, termId: string) {
  const rows = await (
    await getDataSource()
  ).query<{ rule_code: string; severity: Severity }[]>(
    `SELECT t.rule_code, t.severity FROM alerts a
     JOIN rule_triggers t ON t.id = ANY(a.current_trigger_ids)
     WHERE a.student_id = $1 AND a.term_id = $2 AND a.status = ANY($3)`,
    [studentId, termId, OPEN_ALERT_STATUSES],
  );
  return SOURCES.map((source) => ({
    source,
    severity: rows
      .filter((r) => sourceOf(r.rule_code) === source)
      .reduce<Severity | null>((w, r) => (rank(r.severity) > rank(w) ? r.severity : w), null),
  }));
}

async function attendanceSeries(
  studentId: string,
  termId: string,
  countExcused: boolean,
): Promise<AttendanceSeriesDto[]> {
  const rows = await (
    await getDataSource()
  ).query<
    {
      course_id: string;
      course_name: string | null;
      snapshot_date: Date;
      total_periods: number;
      excused_absence: number;
      unexcused_absence: number;
    }[]
  >(
    `SELECT e.course_id, co.course_name, x.snapshot_date, x.total_periods,
       x.excused_absence, x.unexcused_absence
     FROM attendance_summaries x
     JOIN enrollments e ON e.enrollment_id = x.enrollment_id
     LEFT JOIN courses co ON co.course_id = e.course_id
     WHERE e.student_id = $1 AND e.term_id = $2
     ORDER BY e.course_id, x.snapshot_date`,
    [studentId, termId],
  );
  const series = new Map<string, AttendanceSeriesDto>();
  for (const r of rows) {
    const s = series.get(r.course_id) ?? {
      courseId: r.course_id,
      courseName: r.course_name ?? r.course_id,
      points: [],
    };
    const absences = r.unexcused_absence + (countExcused ? r.excused_absence : 0);
    s.points.push({
      date: iso(r.snapshot_date),
      rate: r.total_periods > 0 ? Math.round((absences / r.total_periods) * 1000) / 10 : 0,
    });
    series.set(r.course_id, s);
  }
  return [...series.values()];
}

/**
 * Dòng thời gian (người dùng chốt 2026-10-19): cảnh báo (phát hiện, đổi trạng thái), can thiệp
 * (CHỈ loại — không có nội dung, docs/rules/04), ngày chốt điểm danh và công bố điểm. Mới nhất trước.
 */
async function timeline(studentId: string, termId: string): Promise<TimelineEventDto[]> {
  const ds = await getDataSource();
  const [alerts, history, interventions, attendance, results] = await Promise.all([
    ds.query<{ first_detected_at: Date; severity: Severity }[]>(
      `SELECT first_detected_at, severity FROM alerts WHERE student_id = $1 AND term_id = $2`,
      [studentId, termId],
    ),
    ds.query<{ changed_at: Date; to_status: AlertStatus }[]>(
      `SELECT h.changed_at, h.to_status FROM alert_state_history h
       JOIN alerts a ON a.alert_id = h.alert_id
       WHERE a.student_id = $1 AND a.term_id = $2 AND h.from_status IS NOT NULL`,
      [studentId, termId],
    ),
    ds.query<{ performed_at: Date; type: InterventionType; status: string }[]>(
      `SELECT i.performed_at, i.type, i.status FROM interventions i
       JOIN alerts a ON a.alert_id = i.alert_id WHERE a.student_id = $1 AND a.term_id = $2`,
      [studentId, termId],
    ),
    ds.query<
      {
        snapshot_date: Date;
        course_name: string | null;
        course_id: string;
        total_periods: number;
        excused_absence: number;
        unexcused_absence: number;
      }[]
    >(
      `SELECT x.snapshot_date, co.course_name, e.course_id, x.total_periods,
         x.excused_absence, x.unexcused_absence
       FROM attendance_summaries x JOIN enrollments e ON e.enrollment_id = x.enrollment_id
       LEFT JOIN courses co ON co.course_id = e.course_id
       WHERE e.student_id = $1 AND e.term_id = $2`,
      [studentId, termId],
    ),
    ds.query<
      {
        published_at: Date;
        course_name: string | null;
        course_id: string;
        letter_grade: string;
        passed: boolean;
      }[]
    >(
      `SELECT r.published_at, co.course_name, e.course_id, r.letter_grade, r.passed
       FROM course_results r JOIN enrollments e ON e.enrollment_id = r.enrollment_id
       LEFT JOIN courses co ON co.course_id = e.course_id
       WHERE e.student_id = $1 AND e.term_id = $2`,
      [studentId, termId],
    ),
  ]);
  const events: TimelineEventDto[] = [
    ...alerts.map((a): TimelineEventDto => ({
      kind: 'ALERT_DETECTED',
      at: iso(a.first_detected_at),
      severity: a.severity,
    })),
    ...history.map((h): TimelineEventDto => ({
      kind: 'ALERT_STATUS',
      at: iso(h.changed_at),
      toStatus: h.to_status,
    })),
    ...interventions.map((i): TimelineEventDto => ({
      kind: 'INTERVENTION',
      at: iso(i.performed_at),
      interventionType: i.type,
      followUp: i.status === 'FOLLOW_UP',
    })),
    ...attendance.map((x): TimelineEventDto => ({
      kind: 'ATTENDANCE',
      at: iso(x.snapshot_date),
      courseName: x.course_name ?? x.course_id,
      absences: x.excused_absence + x.unexcused_absence,
      totalPeriods: x.total_periods,
    })),
    ...results.map((r): TimelineEventDto => ({
      kind: 'RESULT',
      at: iso(r.published_at),
      courseName: r.course_name ?? r.course_id,
      letterGrade: r.letter_grade,
      passed: r.passed,
    })),
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, TIMELINE_LIMIT);
}

export async function getStudentInsights(
  studentId: string,
  termId: string,
): Promise<StudentInsightsDto> {
  const threshold = await getAttendanceThreshold();
  const [sources, attendance, gpas, events] = await Promise.all([
    sourceLevels(studentId, termId),
    attendanceSeries(studentId, termId, threshold?.countExcused ?? true),
    getStudentTermGpas(studentId),
    timeline(studentId, termId),
  ]);
  return { sources, threshold, attendance, gpas, timeline: events };
}
