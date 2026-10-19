import { getDataSource } from '@/db/data-source';
import { type AlertStatus, type Severity, SEVERITY_ORDER } from '@/db/enums';

/** Cột "Cả học kỳ" — luật xét cả học kỳ (học lực, kết hợp), `scopeId = studentId`. */
export const TERM_COLUMN = '__TERM__';

export interface MatrixRowDto {
  studentId: string;
  fullName: string;
  /** Cảnh báo chưa đóng của sinh viên trong học kỳ (null = không có). */
  alertId: string | null;
  alertStatus: AlertStatus | null;
  /** Mức dấu hiệu nặng nhất theo cột (mã học phần hoặc TERM_COLUMN). */
  cells: Record<string, Severity>;
  /** Học phần sinh viên có đăng ký trong học kỳ. */
  enrolled: string[];
  worst: Severity | null;
}

export interface ClassMatrixDto {
  classId: string;
  courses: { courseId: string; courseName: string }[];
  rows: MatrixRowDto[];
}

const rank = (s: Severity | null) => (s ? SEVERITY_ORDER.indexOf(s) : -1);

/**
 * Ma trận sinh viên × học phần của 1 lớp (docs/rules/07, người dùng chốt 2026-10-19). Trả null khi
 * lớp không do Cố vấn học tập này phụ trách (phạm vi suy ra qua lớp — docs/rules/06). Ô = mức
 * nặng nhất trong DẤU HIỆU HIỆN TẠI của cảnh báo chưa đóng.
 */
export async function getClassMatrix(
  advisorId: string,
  classId: string,
  termId: string,
): Promise<ClassMatrixDto | null> {
  const ds = await getDataSource();
  const [owned] = await ds.query<{ n: string }[]>(
    `SELECT COUNT(*) AS n FROM administrative_classes WHERE class_id = $1 AND advisor_id = $2`,
    [classId, advisorId],
  );
  if (Number(owned?.n ?? 0) === 0) return null;
  const [students, enrollments, signals] = await Promise.all([
    ds.query<{ student_id: string; full_name: string }[]>(
      `SELECT student_id, full_name FROM students WHERE class_id = $1 ORDER BY student_id`,
      [classId],
    ),
    ds.query<{ student_id: string; course_id: string; course_name: string | null }[]>(
      `SELECT e.student_id, e.course_id, co.course_name FROM enrollments e
       JOIN students s ON s.student_id = e.student_id
       LEFT JOIN courses co ON co.course_id = e.course_id
       WHERE s.class_id = $1 AND e.term_id = $2`,
      [classId, termId],
    ),
    ds.query<
      {
        alert_id: string;
        student_id: string;
        status: AlertStatus;
        scope_id: string | null;
        severity: Severity | null;
      }[]
    >(
      `SELECT a.alert_id, a.student_id, a.status, t.scope_id, t.severity
       FROM alerts a JOIN students s ON s.student_id = a.student_id
       LEFT JOIN rule_triggers t ON t.id = ANY(a.current_trigger_ids)
       WHERE s.class_id = $1 AND a.term_id = $2
         AND a.status IN ('OPEN','REOPENED','ACKNOWLEDGED','IN_PROGRESS')`,
      [classId, termId],
    ),
  ]);
  const courseName = new Map<string, string>();
  const enrolled = new Map<string, string[]>();
  for (const e of enrollments) {
    courseName.set(e.course_id, e.course_name ?? e.course_id);
    enrolled.set(e.student_id, [...(enrolled.get(e.student_id) ?? []), e.course_id]);
  }
  const rows = students.map((st): MatrixRowDto => {
    const mine = signals.filter((x) => x.student_id === st.student_id);
    const cells: Record<string, Severity> = {};
    for (const x of mine) {
      if (!x.severity || !x.scope_id) continue;
      const column = x.scope_id === st.student_id ? TERM_COLUMN : x.scope_id;
      if (rank(x.severity) > rank(cells[column] ?? null)) cells[column] = x.severity;
    }
    const worst = Object.values(cells).reduce<Severity | null>(
      (w, s) => (rank(s) > rank(w) ? s : w),
      null,
    );
    return {
      studentId: st.student_id,
      fullName: st.full_name,
      alertId: mine[0]?.alert_id ?? null,
      alertStatus: mine[0]?.status ?? null,
      cells,
      enrolled: enrolled.get(st.student_id) ?? [],
      worst,
    };
  });
  rows.sort((a, b) => rank(b.worst) - rank(a.worst) || a.studentId.localeCompare(b.studentId));
  return {
    classId,
    courses: [...courseName.entries()]
      .map(([courseId, name]) => ({ courseId, courseName: name }))
      .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    rows,
  };
}
