import { type DataWarning, type EnrollmentFacts, type TermResultInput } from './types';

/**
 * ĐTB hệ 4 và tín chỉ không đạt của 1 học kỳ (docs/rules/08) — hàm thuần dùng chung cho ACA-02,
 * ACA-03, ACA-04 và RiskScore. Mọi so sánh bằng số nguyên phần mười (A = 3,8 không phải nửa điểm).
 */
export interface TermAcademics {
  /** Σ tín chỉ của các kết quả có tín chỉ và điểm chữ quy đổi được. */
  credits: number;
  /** Σ(10 × điểm hệ 4 × tín chỉ). */
  pointTenths: number;
  failedCredits: number;
  failedCourses: TermResultInput[];
  warnings: DataWarning[];
}

const toTenths = (value: number) => Math.round(value * 10);

export function termAcademics(
  results: readonly TermResultInput[],
  gradeScale: Readonly<Record<string, number>>,
): TermAcademics {
  const summary: TermAcademics = {
    credits: 0,
    pointTenths: 0,
    failedCredits: 0,
    failedCourses: [],
    warnings: [],
  };
  for (const r of results) {
    if (!r.credits) {
      summary.warnings.push({
        code: 'COURSE_CREDITS_MISSING',
        courseId: r.courseId,
        message: `Học phần ${r.courseName} chưa có số tín chỉ — bỏ qua khi tính ĐTB và tín chỉ không đạt.`,
      });
      continue;
    }
    const point = gradeScale[r.letterGrade];
    if (point === undefined) {
      summary.warnings.push({
        code: 'UNKNOWN_LETTER_GRADE',
        courseId: r.courseId,
        message: `Điểm chữ "${r.letterGrade}" chưa có trong thang quy đổi — bỏ qua khi tính ĐTB.`,
      });
      continue;
    }
    summary.credits += r.credits;
    summary.pointTenths += toTenths(point) * r.credits;
    if (!r.passed) {
      summary.failedCredits += r.credits;
      summary.failedCourses.push(r);
    }
  }
  return summary;
}

/** ĐTB < ngưỡng, so sánh nguyên: Σ(10 × điểm × TC) < 10 × ngưỡng × ΣTC. */
export function gpaBelow(a: TermAcademics, threshold: number): boolean {
  return a.credits > 0 && a.pointTenths < toTenths(threshold) * a.credits;
}

/** ĐTB thực (hiển thị) — null khi chưa có tín chỉ nào. */
export function gpaValue(a: TermAcademics): number | null {
  return a.credits > 0 ? a.pointTenths / 10 / a.credits : null;
}

/** Kết quả học phần (tại asOf) của các Enrollment học kỳ đang tính — đầu vào ACA-02/03/04. */
export function termResults(facts: readonly EnrollmentFacts[]): TermResultInput[] {
  return facts.flatMap((f) =>
    f.result
      ? [
          {
            courseId: f.input.courseId,
            courseName: f.input.courseName,
            credits: f.input.credits,
            letterGrade: f.result.letterGrade,
            passed: f.result.passed,
            publishedAt: f.result.publishedAt,
          },
        ]
      : [],
  );
}
