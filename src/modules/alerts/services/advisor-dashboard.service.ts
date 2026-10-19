import { getDataSource } from '@/db/data-source';
import { type AlertStatus, type InterventionType, type Severity } from '@/db/enums';

/**
 * Số liệu riêng trang tổng quan Cố vấn học tập — phạm vi luôn là lớp có `advisorId` = người gọi
 * (suy ra qua lớp, docs/rules/06). Học kỳ do trang chọn.
 */

export interface AdvisorClassDto {
  classId: string;
  className: string;
  students: number;
  /** Sinh viên có cảnh báo chưa đóng trong học kỳ. */
  studentsWithAlerts: number;
}

export async function getAdvisorClasses(
  advisorId: string,
  termId: string,
): Promise<AdvisorClassDto[]> {
  const ds = await getDataSource();
  const rows = await ds.query<
    { class_id: string; class_name: string; students: string; with_alerts: string }[]
  >(
    `SELECT c.class_id, c.class_name,
       (SELECT COUNT(*) FROM students s WHERE s.class_id = c.class_id) AS students,
       (SELECT COUNT(DISTINCT a.student_id) FROM alerts a
          JOIN students s ON s.student_id = a.student_id
          WHERE s.class_id = c.class_id AND a.term_id = $2
            AND a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')) AS with_alerts
     FROM administrative_classes c WHERE c.advisor_id = $1 ORDER BY c.class_id`,
    [advisorId, termId],
  );
  return rows.map((r) => ({
    classId: r.class_id,
    className: r.class_name,
    students: Number(r.students),
    studentsWithAlerts: Number(r.with_alerts),
  }));
}

export interface AttentionStudentDto {
  alertId: string;
  studentId: string;
  studentName: string;
  classId: string;
  severity: Severity;
  status: AlertStatus;
  riskScore: number | null;
}

/** Sinh viên cần chú ý nhất: cảnh báo chưa đóng, mức cao nhất trước rồi RiskScore. */
export async function getAttentionStudents(
  advisorId: string,
  termId: string,
  limit = 5,
): Promise<AttentionStudentDto[]> {
  const ds = await getDataSource();
  const rows = await ds.query<
    {
      alert_id: string;
      student_id: string;
      full_name: string;
      class_id: string;
      severity: Severity;
      status: AlertStatus;
      risk: number | null;
    }[]
  >(
    `SELECT a.alert_id, a.student_id, s.full_name, s.class_id, a.severity, a.status,
       l.risk_score_value AS risk
     FROM alerts a
     JOIN students s ON s.student_id = a.student_id
     JOIN administrative_classes c ON c.class_id = s.class_id
     LEFT JOIN risk_score_logs l ON l.id = a.risk_score_log_id
     WHERE c.advisor_id = $1 AND a.term_id = $2
       AND a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')
     ORDER BY a.severity DESC, l.risk_score_value DESC NULLS LAST, a.student_id
     LIMIT $3`,
    [advisorId, termId, limit],
  );
  return rows.map((r) => ({
    alertId: r.alert_id,
    studentId: r.student_id,
    studentName: r.full_name,
    classId: r.class_id,
    severity: r.severity,
    status: r.status,
    riskScore: r.risk,
  }));
}

export interface FollowUpDto {
  alertId: string;
  studentId: string;
  studentName: string;
  dueAt: string;
}

/**
 * Hẹn theo dõi đến hạn: can thiệp MỚI NHẤT của cảnh báo (còn mở) có `status = FOLLOW_UP` và
 * `nextFollowUpAt` không muộn hơn cuối ngày hôm nay — do chính Cố vấn học tập này ghi.
 */
export async function getDueFollowUps(advisorId: string, termId: string): Promise<FollowUpDto[]> {
  const ds = await getDataSource();
  const rows = await ds.query<
    { alert_id: string; student_id: string; full_name: string; due: Date }[]
  >(
    `SELECT x.alert_id, a.student_id, s.full_name, x.next_follow_up_at AS due
     FROM (
       SELECT DISTINCT ON (i.alert_id) i.alert_id, i.status, i.next_follow_up_at, i.performed_by
       FROM interventions i ORDER BY i.alert_id, i.performed_at DESC
     ) x
     JOIN alerts a ON a.alert_id = x.alert_id
     JOIN students s ON s.student_id = a.student_id
     JOIN administrative_classes c ON c.class_id = s.class_id
     WHERE c.advisor_id = $1 AND a.term_id = $2 AND x.performed_by = $1
       AND x.status = 'FOLLOW_UP' AND x.next_follow_up_at IS NOT NULL
       AND x.next_follow_up_at < date_trunc('day', now()) + interval '1 day'
       AND a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')
     ORDER BY x.next_follow_up_at`,
    [advisorId, termId],
  );
  return rows.map((r) => ({
    alertId: r.alert_id,
    studentId: r.student_id,
    studentName: r.full_name,
    dueAt: new Date(r.due).toISOString(),
  }));
}

export type ActivityDto =
  | {
      kind: 'STATUS';
      at: string;
      alertId: string;
      studentId: string;
      studentName: string;
      toStatus: AlertStatus;
    }
  | {
      kind: 'INTERVENTION';
      at: string;
      alertId: string;
      studentId: string;
      studentName: string;
      interventionType: InterventionType;
    };

/** Hoạt động gần đây của chính Cố vấn học tập: đổi trạng thái cảnh báo + ghi can thiệp. */
export async function getRecentActivity(advisorId: string, limit = 8): Promise<ActivityDto[]> {
  const ds = await getDataSource();
  const rows = await ds.query<
    {
      kind: 'STATUS' | 'INTERVENTION';
      at: Date;
      alert_id: string;
      student_id: string;
      full_name: string;
      detail: string;
    }[]
  >(
    `SELECT * FROM (
       SELECT 'STATUS' AS kind, h.changed_at AS at, h.alert_id, a.student_id, s.full_name,
         h.to_status::text AS detail
       FROM alert_state_history h
       JOIN alerts a ON a.alert_id = h.alert_id JOIN students s ON s.student_id = a.student_id
       WHERE h.changed_by = $1
       UNION ALL
       SELECT 'INTERVENTION', i.performed_at, i.alert_id, a.student_id, s.full_name, i.type::text
       FROM interventions i
       JOIN alerts a ON a.alert_id = i.alert_id JOIN students s ON s.student_id = a.student_id
       WHERE i.performed_by = $1
     ) x ORDER BY at DESC LIMIT $2`,
    [advisorId, limit],
  );
  return rows.map((r) =>
    r.kind === 'STATUS'
      ? {
          kind: 'STATUS',
          at: new Date(r.at).toISOString(),
          alertId: r.alert_id,
          studentId: r.student_id,
          studentName: r.full_name,
          toStatus: r.detail as AlertStatus,
        }
      : {
          kind: 'INTERVENTION',
          at: new Date(r.at).toISOString(),
          alertId: r.alert_id,
          studentId: r.student_id,
          studentName: r.full_name,
          interventionType: r.detail as InterventionType,
        },
  );
}
