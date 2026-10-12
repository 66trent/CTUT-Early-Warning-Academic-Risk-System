import { In } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { type ImportBatch } from '@/db/entities/import-batch.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { hasLostDiacritics, LOST_DIACRITICS_HINT } from '../parsing/values';
import { type RowError } from './definition';

/** Phần chung của 1 dòng dữ liệu học tập (điểm danh, LMS, kết quả học phần). */
export interface AcademicRowBase {
  studentId: string;
  courseId: string;
  /** `ten_hoc_phan` nếu file có — dùng khi tự tạo `Course`. */
  courseName: string | null;
  /** Cột `hoc_ky` (tùy chọn) — nếu có MUST khớp học kỳ đã chọn. */
  termCode: string | null;
}

/** Cột tùy chọn chung của 3 loại nhập học tập. */
export const ACADEMIC_OPTIONAL_COLUMNS = ['hoc_ky'] as const;

export const pairKey = (row: { studentId: string; courseId: string }) =>
  `${row.studentId}|${row.courseId}`;

/** Chuẩn hóa mssv, mã học phần, tên học phần, học kỳ. Trả lỗi định dạng hoặc phần chung. */
export function parseAcademicBase(
  record: Readonly<Record<string, string>>,
): { ok: true; value: AcademicRowBase } | { ok: false; detail: string } {
  const studentId = (record.mssv ?? '').trim().toUpperCase();
  const courseId = (record.ma_hoc_phan ?? '').trim().toUpperCase();
  const courseName = (record.ten_hoc_phan ?? '').trim().replace(/\s+/g, ' ');
  const termCode = (record.hoc_ky ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(studentId)) {
    return { ok: false, detail: 'Mã số sinh viên gồm 3–20 chữ cái hoặc chữ số, không để trống.' };
  }
  if (!/^[A-Z0-9._-]{2,20}$/.test(courseId)) {
    return { ok: false, detail: 'Mã học phần gồm 2–20 chữ cái hoặc chữ số, không để trống.' };
  }
  if (courseName.length > 150) return { ok: false, detail: 'Tên học phần tối đa 150 ký tự.' };
  if (hasLostDiacritics(courseName)) {
    return { ok: false, detail: `Tên học phần "${courseName}" ${LOST_DIACRITICS_HINT}` };
  }
  return {
    ok: true,
    value: {
      studentId,
      courseId,
      courseName: courseName || null,
      termCode: termCode || null,
    },
  };
}

/** Kiểm tra thời điểm nằm trong thời gian học kỳ (cả 2 đầu). */
export function isWithinTerm(at: Date, term: Pick<Term, 'startDate' | 'endDate'>): boolean {
  return at.getTime() >= term.startDate.getTime() && at.getTime() <= term.endDate.getTime();
}

/**
 * Đối chiếu chung cho 3 loại nhập học tập: sinh viên phải có trong danh sách (KHÔNG tự tạo),
 * cột `hoc_ky` (nếu có) khớp học kỳ đã chọn, rồi kiểm tra riêng của từng loại (`extra`).
 */
export async function checkAcademicReferences<T extends AcademicRowBase>(
  rows: readonly T[],
  em: EntityManager,
  batch: ImportBatch,
  extra?: (row: T, term: Term) => RowError | null,
): Promise<Map<number, RowError>> {
  const errors = new Map<number, RowError>();
  const [term, students] = await Promise.all([
    em.findOneByOrFail(Term, { termId: batch.termId ?? '' }),
    em.find(Student, {
      select: { studentId: true },
      where: { studentId: In([...new Set(rows.map((r) => r.studentId))]) },
    }),
  ]);
  const known = new Set(students.map((s) => s.studentId));
  rows.forEach((row, i) => {
    if (!known.has(row.studentId)) {
      errors.set(i, {
        reason: 'STUDENT_NOT_FOUND',
        detail: `Sinh viên ${row.studentId} chưa có trong danh sách — nhập danh sách sinh viên trước.`,
      });
    } else if (row.termCode && row.termCode !== term.termId) {
      errors.set(i, {
        reason: 'TERM_MISMATCH',
        detail: `Cột học kỳ ghi ${row.termCode} nhưng lô nhập chọn ${term.termId}.`,
      });
    } else {
      const error = extra?.(row, term);
      if (error) errors.set(i, error);
    }
  });
  return errors;
}
