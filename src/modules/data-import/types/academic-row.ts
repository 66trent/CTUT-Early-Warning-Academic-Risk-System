import { In } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { type ImportBatch } from '@/db/entities/import-batch.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { hasLostDiacritics, LOST_DIACRITICS_HINT, stripDiacritics } from '../parsing/values';
import { type RowError, type RowWarning } from './definition';

/** Phần chung của 1 dòng dữ liệu học tập (điểm danh, LMS, kết quả học phần). */
export interface AcademicRowBase {
  studentId: string;
  courseId: string;
  /** Mã học phần suy từ mã lớp học phần (file để trống `ma_hoc_phan`). */
  derivedCode: boolean;
  /** Mã lớp học phần (`ma_lop_hoc_phan`). */
  sectionCode: string;
  /** `ten_hoc_phan` nếu file có — dùng khi tự tạo `Course`. */
  courseName: string | null;
  /** `ho_dem` + `ten` nếu file có — chỉ để đối chiếu, không lưu. */
  givenName: string | null;
  /** Cột `hoc_ky` (tùy chọn) — nếu có MUST khớp học kỳ đã chọn. */
  termCode: string | null;
}

/** Cột bắt buộc / tùy chọn chung của 4 loại nhập học tập (docs/rules/12). */
export const ACADEMIC_REQUIRED_COLUMNS = ['mssv', 'ma_lop_hoc_phan'] as const;
export const ACADEMIC_OPTIONAL_COLUMNS = ['ma_hoc_phan', 'ho_dem', 'ten', 'hoc_ky'] as const;

export const pairKey = (row: { studentId: string; courseId: string }) =>
  `${row.studentId}|${row.courseId}`;

/**
 * Mã học phần từ mã lớp học phần: bỏ 2 ký tự cuối (VD `010100240802` → `0101002408`).
 * Giả định chưa xác nhận chính thức (docs/rules/12) — màn xem trước ghi "tự suy".
 */
export function deriveCourseCode(sectionCode: string): string {
  return sectionCode.slice(0, -2);
}

/** Họ tên để so khớp: bỏ dấu, chữ thường, gộp khoảng trắng. */
export function nameKey(name: string): string {
  return stripDiacritics(name).replace(/\s+/g, ' ').trim();
}

/** Chuẩn hóa mssv, mã lớp học phần / học phần, tên, học kỳ. Trả lỗi định dạng hoặc phần chung. */
export function parseAcademicBase(
  record: Readonly<Record<string, string>>,
): { ok: true; value: AcademicRowBase } | { ok: false; detail: string } {
  const studentId = (record.mssv ?? '').trim().toUpperCase();
  const sectionCode = (record.ma_lop_hoc_phan ?? '').trim().toUpperCase();
  const givenCode = (record.ma_hoc_phan ?? '').trim().toUpperCase();
  const courseName = (record.ten_hoc_phan ?? '').trim().replace(/\s+/g, ' ');
  const givenName = [record.ho_dem, record.ten]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const termCode = (record.hoc_ky ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(studentId)) {
    return { ok: false, detail: 'Mã số sinh viên gồm 3–20 chữ cái hoặc chữ số, không để trống.' };
  }
  if (!/^[A-Z0-9._-]{4,30}$/.test(sectionCode)) {
    return { ok: false, detail: 'Mã lớp học phần gồm 4–30 chữ cái hoặc chữ số, không để trống.' };
  }
  const courseId = givenCode || deriveCourseCode(sectionCode);
  if (!/^[A-Z0-9._-]{2,20}$/.test(courseId)) {
    return { ok: false, detail: 'Mã học phần gồm 2–20 chữ cái hoặc chữ số.' };
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
      derivedCode: !givenCode,
      sectionCode,
      courseName: courseName || null,
      givenName: givenName || null,
      termCode: termCode || null,
    },
  };
}

/** Kiểm tra thời điểm nằm trong thời gian học kỳ (cả 2 đầu). */
export function isWithinTerm(at: Date, term: Pick<Term, 'startDate' | 'endDate'>): boolean {
  return at.getTime() >= term.startDate.getTime() && at.getTime() <= term.endDate.getTime();
}

/** Lỗi đối chiếu chung của 1 dòng (thứ tự: sinh viên → học kỳ → học phần đã chọn). */
function baseError(
  row: AcademicRowBase,
  known: ReadonlyMap<string, string>,
  term: Term,
  batch: ImportBatch,
): RowError | null {
  if (!known.has(row.studentId)) {
    return {
      reason: 'STUDENT_NOT_FOUND',
      detail: `Sinh viên ${row.studentId} chưa có trong danh sách — nhập danh sách sinh viên trước.`,
    };
  }
  if (row.termCode && row.termCode !== term.termId) {
    return {
      reason: 'TERM_MISMATCH',
      detail: `Cột học kỳ ghi ${row.termCode} nhưng lô nhập chọn ${term.termId}.`,
    };
  }
  if (batch.courseId && row.courseId !== batch.courseId) {
    return {
      reason: 'COURSE_MISMATCH',
      detail: `Dòng thuộc học phần ${row.courseId} nhưng lô nhập chọn học phần ${batch.courseId}.`,
    };
  }
  return null;
}

/**
 * Đối chiếu chung cho 4 loại nhập học tập: sinh viên phải có trong danh sách (KHÔNG tự tạo),
 * cột `hoc_ky` khớp học kỳ đã chọn, học phần khớp học phần Admin chọn (nếu có), rồi kiểm tra
 * riêng của từng loại (`extra`). Họ tên trong file lệch hệ thống → cảnh báo `NAME_MISMATCH`.
 */
export async function checkAcademicReferences<T extends AcademicRowBase>(
  rows: readonly T[],
  em: EntityManager,
  batch: ImportBatch,
  warn: (index: number, warning: RowWarning) => void,
  extra?: (row: T, term: Term) => RowError | null,
): Promise<Map<number, RowError>> {
  const errors = new Map<number, RowError>();
  const [term, students] = await Promise.all([
    em.findOneByOrFail(Term, { termId: batch.termId ?? '' }),
    em.find(Student, {
      select: { studentId: true, fullName: true },
      where: { studentId: In([...new Set(rows.map((r) => r.studentId))]) },
    }),
  ]);
  const known = new Map(students.map((s) => [s.studentId, s.fullName]));
  rows.forEach((row, i) => {
    const error = baseError(row, known, term, batch) ?? extra?.(row, term) ?? null;
    if (error) {
      errors.set(i, error);
      return;
    }
    const fullName = known.get(row.studentId) ?? '';
    if (row.givenName && nameKey(row.givenName) !== nameKey(fullName)) {
      warn(i, {
        code: 'NAME_MISMATCH',
        message: `Họ tên trong file "${row.givenName}" khác hệ thống "${fullName}" — có thể sai MSSV.`,
      });
    }
  });
  return errors;
}
