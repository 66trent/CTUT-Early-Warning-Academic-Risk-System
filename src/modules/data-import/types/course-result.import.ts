import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { Course } from '@/db/entities/course.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { AttemptOutcome, EnrollmentStatus } from '@/db/enums';
import { ensureEnrollments, recomputeAttemptNumbers } from '../services/enrollment-sync';
import { rollbackSourceRows } from '../services/source-rollback';
import { isLetterGrade, isPassingLetter, type LetterGrade } from '../parsing/grade-scale';
import { labelKey, parseDate, parseDecimal, parseInteger } from '../parsing/values';
import {
  ACADEMIC_OPTIONAL_COLUMNS,
  ACADEMIC_REQUIRED_COLUMNS,
  type AcademicRowBase,
  checkAcademicReferences,
  pairKey,
  parseAcademicBase,
} from './academic-row';
import {
  type ImportTypeDefinition,
  type LoadResult,
  type ParsedRow,
  type RowWarning,
} from './definition';

export interface CourseResultRow extends AcademicRowBase {
  credits: number;
  processScore: number | null;
  examScore: number | null;
  letterGrade: LetterGrade;
  passed: boolean;
  eligibleForExam: boolean | null;
  absentFromExam: boolean | null;
  /** `YYYY-MM-DD` hoặc null (= lúc nạp). */
  publishedAt: string | null;
}

/** Quy đổi điểm chữ → hệ 4 (× 10) để đối chiếu cột `thang_diem_4` (Quy chế 336 — docs/rules/08). */
const GRADE_POINT_TENTHS: Record<LetterGrade, number> = {
  'A+': 40,
  A: 38,
  'B+': 35,
  B: 30,
  'C+': 25,
  C: 20,
  'D+': 15,
  D: 10,
  F: 0,
};

/** Ô có/không: `Có`, `x`, `1`, `TRUE` / `Không`, `0`, `FALSE`; trống → null. */
const YES_NO: Record<string, boolean> = {
  co: true,
  x: true,
  '1': true,
  true: true,
  yes: true,
  khong: false,
  '0': false,
  false: false,
  no: false,
};

type Failure = ParsedRow<CourseResultRow> & { ok: false };
const invalid = (detail: string): Failure => ({ ok: false, reason: 'INVALID_FORMAT', detail });

const SCORE_COLUMNS = [
  ['diem_thuong_xuyen', 'Điểm thường xuyên', 'processScore'],
  ['diem_cuoi_ky', 'Điểm cuối kỳ', 'examScore'],
] as const;
type ScoreField = (typeof SCORE_COLUMNS)[number][2];

function parseScores(
  record: Readonly<Record<string, string>>,
  decimalComma: boolean,
): { ok: true; value: Record<ScoreField, number | null> } | Failure {
  const value = {} as Record<ScoreField, number | null>;
  for (const [column, label, field] of SCORE_COLUMNS) {
    const text = (record[column] ?? '').trim();
    if (!text) {
      value[field] = null;
      continue;
    }
    const score = parseDecimal(text, decimalComma);
    if (!score.ok) return invalid(`${label}: ${score.message}`);
    if (score.value < 0 || score.value > 10) {
      return { ok: false, reason: 'OUT_OF_RANGE', detail: `${label} ${text} phải từ 0 đến 10.` };
    }
    value[field] = score.value;
  }
  return { ok: true, value };
}

function parseYesNo(
  raw: string | undefined,
  label: string,
): { ok: true; value: boolean | null } | Failure {
  const text = labelKey(raw ?? '');
  if (!text) return { ok: true, value: null };
  const value = YES_NO[text];
  return value === undefined ? invalid(`${label}: ghi Có hoặc Không.`) : { ok: true, value };
}

/** Cột `thang_diem_4` (tùy chọn) chỉ để đối chiếu — lệch quy đổi → cảnh báo, dùng điểm chữ. */
function gradePointWarning(
  raw: string | undefined,
  letter: LetterGrade,
  decimalComma: boolean,
): RowWarning | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const given = parseDecimal(text, decimalComma || text.includes(','));
  if (given.ok && Math.round(given.value * 10) === GRADE_POINT_TENTHS[letter]) return null;
  return {
    code: 'GRADE_POINT_MISMATCH',
    message: `Thang điểm 4 "${text}" khác quy đổi của điểm chữ ${letter} (${GRADE_POINT_TENTHS[letter] / 10}) — hệ thống dùng điểm chữ.`,
  };
}

const vnMidnight = (date: string) => new Date(`${date}T00:00:00+07:00`);

function sameValues(a: CourseResult, row: CourseResultRow): boolean {
  return (
    a.processScore === row.processScore &&
    a.examScore === row.examScore &&
    a.letterGrade === row.letterGrade &&
    a.passed === row.passed &&
    a.eligibleForExam === row.eligibleForExam &&
    a.absentFromExam === row.absentFromExam &&
    (row.publishedAt === null || a.publishedAt.getTime() === vnMidnight(row.publishedAt).getTime())
  );
}

/** Kết quả hiện có của các dòng trong học kỳ của lô, theo `mssv|mã học phần`. */
async function findExistingResults(
  em: EntityManager,
  termId: string,
  rows: readonly AcademicRowBase[],
): Promise<Map<string, CourseResult>> {
  const results = await em.find(CourseResult, {
    relations: { enrollment: true },
    where: {
      enrollment: {
        termId,
        studentId: In([...new Set(rows.map((r) => r.studentId))]),
        courseId: In([...new Set(rows.map((r) => r.courseId))]),
      },
    },
  });
  return new Map(results.map((r) => [r.enrollment ? pairKey(r.enrollment) : '', r]));
}

/** Cập nhật số tín chỉ học phần từ file (docs/rules/09). */
async function updateCredits(em: EntityManager, rows: readonly CourseResultRow[]): Promise<void> {
  const credits = new Map<string, number>();
  for (const row of rows) credits.set(row.courseId, row.credits);
  if (credits.size === 0) return;
  const courses = await em.find(Course, {
    select: { courseId: true, credits: true },
    where: { courseId: In([...credits.keys()]) },
  });
  for (const course of courses) {
    const value = credits.get(course.courseId);
    if (value !== undefined && course.credits !== value) {
      await em.update(Course, { courseId: course.courseId }, { credits: value });
    }
  }
}

/**
 * Kết quả học phần → `attemptOutcome` + `COMPLETED`; outcome đổi → tính lại lần học các học kỳ
 * sau trong CÙNG transaction để thứ tự nạp file không làm sai COMB-02 (docs/rules/10).
 */
async function applyOutcomes(
  em: EntityManager,
  finals: { enrollmentId: string; row: CourseResultRow }[],
): Promise<void> {
  if (finals.length === 0) return;
  const enrollments = await em.find(Enrollment, {
    where: { enrollmentId: In(finals.map((f) => f.enrollmentId)) },
  });
  const byId = new Map(enrollments.map((e) => [e.enrollmentId, e]));
  const changedPairs: { studentId: string; courseId: string }[] = [];
  for (const { enrollmentId, row } of finals) {
    const enrollment = byId.get(enrollmentId);
    if (!enrollment) continue;
    const outcome = row.passed ? AttemptOutcome.PASSED : AttemptOutcome.FAILED;
    if (
      enrollment.attemptOutcome === outcome &&
      enrollment.enrollmentStatus === EnrollmentStatus.COMPLETED
    ) {
      continue;
    }
    await em.update(
      Enrollment,
      { enrollmentId },
      { attemptOutcome: outcome, enrollmentStatus: EnrollmentStatus.COMPLETED },
    );
    if (enrollment.attemptOutcome !== outcome) changedPairs.push(enrollment);
  }
  await recomputeAttemptNumbers(em, changedPairs);
}

/**
 * Kết quả học phần ĐÃ KHÓA ĐIỂM (docs/rules/10, 12 — không còn điểm giữa kỳ, chốt 2026-10-18).
 * Có kết quả → `attemptOutcome` + `COMPLETED`. KHÔNG ghi `Student.officialAcademicStatus`.
 */
export const courseResultImport: ImportTypeDefinition<CourseResultRow> = {
  dataType: 'COURSE_RESULT',
  label: 'Kết quả học phần',
  requiresTerm: true,
  requiredColumns: [...ACADEMIC_REQUIRED_COLUMNS, 'ten_hoc_phan', 'so_tin_chi', 'diem_chu'],
  optionalColumns: [
    ...ACADEMIC_OPTIONAL_COLUMNS,
    'diem_thuong_xuyen',
    'duoc_du_thi',
    'diem_cuoi_ky',
    'vang_thi',
    'thang_diem_4',
    'ngay_cong_bo',
  ],
  templatePath: '/templates/mau_ket_qua_hoc_phan.csv',

  parseRow(record, { decimalComma }) {
    const base = parseAcademicBase(record);
    if (!base.ok) return invalid(base.detail);
    const credits = parseInteger(record.so_tin_chi ?? '');
    if (!credits.ok) return invalid(`Số tín chỉ: ${credits.message}`);
    if (credits.value < 1 || credits.value > 30) {
      return { ok: false, reason: 'OUT_OF_RANGE', detail: 'Số tín chỉ phải từ 1 đến 30.' };
    }
    const letterText = (record.diem_chu ?? '').trim().toUpperCase();
    if (!isLetterGrade(letterText)) {
      return invalid(
        `Điểm chữ "${record.diem_chu ?? ''}" không thuộc thang A+, A, B+, B, C+, C, D+, D, F.`,
      );
    }
    const scores = parseScores(record, decimalComma);
    if (!scores.ok) return scores;
    const eligible = parseYesNo(record.duoc_du_thi, 'Được dự thi');
    if (!eligible.ok) return eligible;
    const absent = parseYesNo(record.vang_thi, 'Vắng thi');
    if (!absent.ok) return absent;
    const publishedText = (record.ngay_cong_bo ?? '').trim();
    const published = publishedText ? parseDate(publishedText) : null;
    if (published && !published.ok) return invalid(`Ngày công bố: ${published.message}`);
    const warning = gradePointWarning(record.thang_diem_4, letterText, decimalComma);
    return {
      ok: true,
      value: {
        ...base.value,
        ...scores.value,
        credits: credits.value,
        letterGrade: letterText,
        passed: isPassingLetter(letterText),
        eligibleForExam: eligible.value,
        absentFromExam: absent.value,
        publishedAt: published?.ok ? published.value : null,
      },
      warnings: warning ? [warning] : [],
    };
  },

  uniqueKeys: (row) => [pairKey(row)],

  checkReferences(rows, em, batch, warn) {
    return checkAcademicReferences(rows, em, batch, warn);
  },

  describe: (row) => ({
    courseId: row.courseId,
    courseName: row.courseName,
    derivedCode: row.derivedCode,
    sectionCode: row.sectionCode,
    studentId: row.studentId,
    credits: row.credits,
    publishedDate: row.publishedAt,
  }),

  async load(rows, em, batch) {
    const enrollments = await ensureEnrollments(em, batch, rows);
    await updateCredits(em, rows);
    const existing = await findExistingResults(em, batch.termId ?? '', rows);
    const now = new Date();
    const result: LoadResult = { inserted: 0, updated: 0, unchanged: 0, createdKeys: [] };
    const inserts: Partial<CourseResult>[] = [];
    const finals: { enrollmentId: string; row: CourseResultRow }[] = [];

    for (const row of rows) {
      const enrollmentId = enrollments.get(pairKey(row)) ?? '';
      const values = {
        processScore: row.processScore,
        examScore: row.examScore,
        letterGrade: row.letterGrade,
        passed: row.passed,
        eligibleForExam: row.eligibleForExam,
        absentFromExam: row.absentFromExam,
      };
      finals.push({ enrollmentId, row });
      const current = existing.get(pairKey(row));
      if (!current) {
        const id = randomUUID();
        inserts.push({
          id,
          enrollmentId,
          ...values,
          importBatchId: batch.id,
          publishedAt: row.publishedAt ? vnMidnight(row.publishedAt) : now,
          importedAt: now,
        });
        result.createdKeys.push(id);
      } else if (sameValues(current, row)) {
        result.unchanged += 1;
      } else {
        await em.update(
          CourseResult,
          { id: current.id },
          {
            ...values,
            importBatchId: batch.id,
            importedAt: now,
            ...(row.publishedAt ? { publishedAt: vnMidnight(row.publishedAt) } : {}),
          },
        );
        result.updated += 1;
      }
    }
    if (inserts.length > 0) await em.insert(CourseResult, inserts);
    result.inserted = inserts.length;
    await applyOutcomes(em, finals);
    return result;
  },

  async rollback(createdKeys, em, batch) {
    const touched = await em
      .createQueryBuilder(Enrollment, 'e')
      .innerJoin(CourseResult, 'r', 'r.enrollmentId = e.enrollmentId')
      .where('r.importBatchId = :batchId', { batchId: batch.id })
      .getMany();
    const outcome = await rollbackSourceRows(CourseResult, createdKeys, em, batch);
    if ('blocked' in outcome) return outcome.blocked;
    // Enrollment do lô tạo đã bị xóa cùng kết quả; Enrollment có sẵn trở về chưa có kết quả.
    if (touched.length > 0) {
      await em.update(
        Enrollment,
        { enrollmentId: In(touched.map((e) => e.enrollmentId)) },
        { attemptOutcome: AttemptOutcome.PENDING, enrollmentStatus: EnrollmentStatus.REGISTERED },
      );
    }
    await recomputeAttemptNumbers(em, touched);
    return null;
  },
};
