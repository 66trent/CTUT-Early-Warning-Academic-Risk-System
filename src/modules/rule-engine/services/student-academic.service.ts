import { getDataSource } from '@/db/data-source';
import { RuleVersion } from '@/db/entities/rule-version.entity';
import { RuleStatus, Severity } from '@/db/enums';
import { gpaValue, termAcademics } from '../evaluator/academic';
import { RISK_SCORE_RULE_CODE, riskScoreConfigSchema } from '../evaluator/config';
import { att01 } from '../evaluator/rules/att-01';

export interface AttendanceThresholdDto {
  /** Ngưỡng phần trăm của dải cao nhất ATT-01 đang áp dụng (VD 20 = vượt 20% bị cấm thi). */
  percent: number;
  /** Có tính tiết vắng có phép không (cùng cách luật tính). */
  countExcused: boolean;
}

/**
 * Vạch ngưỡng vắng hiển thị cho người dùng — đọc từ phiên bản `ATT-01` đang áp dụng, KHÔNG ghi cứng
 * (docs/rules/02). Dải mức cao nhất (thường "> 20%" — ngưỡng cấm thi theo quy chế).
 */
export async function getAttendanceThreshold(): Promise<AttendanceThresholdDto | null> {
  const version = await (
    await getDataSource()
  )
    .getRepository(RuleVersion)
    .findOneBy({ ruleCode: att01.meta.ruleCode, status: RuleStatus.ACTIVE });
  const parsed = version ? att01.conditionSchema.safeParse(version.condition) : null;
  if (!parsed?.success) return null;
  const order = [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL];
  const top = [...parsed.data.bands].sort(
    (a, b) => order.indexOf(b.severity) - order.indexOf(a.severity) || b.percent - a.percent,
  )[0];
  return top ? { percent: top.percent, countExcused: parsed.data.countExcused } : null;
}

export interface TermGpaDto {
  termId: string;
  termName: string;
  /** ĐTB hệ 4 có trọng số tín chỉ; null khi chưa có kết quả quy đổi được. */
  gpa: number | null;
  credits: number;
  failedCredits: number;
}

/**
 * ĐTB hệ 4 từng học kỳ của 1 sinh viên — cùng cách tính với ACA-03 / ACA-04 (`termAcademics`,
 * thang quy đổi trong cấu hình RiskScore đang áp dụng). Học kỳ cũ trước, chỉ học kỳ có kết quả.
 */
export async function getStudentTermGpas(studentId: string): Promise<TermGpaDto[]> {
  const ds = await getDataSource();
  const [config, rows] = await Promise.all([
    ds
      .getRepository(RuleVersion)
      .findOneBy({ ruleCode: RISK_SCORE_RULE_CODE, status: RuleStatus.ACTIVE }),
    ds.query<
      {
        term_id: string;
        term_name: string;
        course_id: string;
        course_name: string;
        credits: number | null;
        letter_grade: string;
        passed: boolean;
        published_at: Date;
      }[]
    >(
      `SELECT t.term_id, t.term_name, e.course_id, co.course_name, co.credits,
         r.letter_grade, r.passed, r.published_at
       FROM course_results r
       JOIN enrollments e ON e.enrollment_id = r.enrollment_id
       JOIN terms t ON t.term_id = e.term_id
       JOIN courses co ON co.course_id = e.course_id
       WHERE e.student_id = $1
       ORDER BY t.start_date, e.course_id`,
      [studentId],
    ),
  ]);
  const parsed = config ? riskScoreConfigSchema.safeParse(config.condition) : null;
  if (!parsed?.success) return [];
  const gradeScale = parsed.data.academic.gradeScale;
  const terms = new Map<string, { name: string; rows: typeof rows }>();
  for (const r of rows) {
    const t = terms.get(r.term_id) ?? { name: r.term_name, rows: [] };
    t.rows.push(r);
    terms.set(r.term_id, t);
  }
  return [...terms.entries()].map(([termId, t]) => {
    const a = termAcademics(
      t.rows.map((r) => ({
        courseId: r.course_id,
        courseName: r.course_name,
        credits: r.credits,
        letterGrade: r.letter_grade,
        passed: r.passed,
        publishedAt: new Date(r.published_at),
      })),
      gradeScale,
    );
    const gpa = gpaValue(a);
    return {
      termId,
      termName: t.name,
      gpa: gpa === null ? null : Math.round(gpa * 100) / 100,
      credits: a.credits,
      failedCredits: a.failedCredits,
    };
  });
}
