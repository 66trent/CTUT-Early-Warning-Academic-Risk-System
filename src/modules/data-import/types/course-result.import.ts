import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { Course } from '@/db/entities/course.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { AttemptOutcome, CourseResultStatus, EnrollmentStatus } from '@/db/enums';
import { ensureEnrollments, recomputeAttemptNumbers } from '../services/enrollment-sync';
import { rollbackSourceRows } from '../services/source-rollback';
import {
  isLetterGrade,
  isPassingLetter,
  type LetterGrade,
  letterFromScore,
} from '../parsing/grade-scale';
import { labelKey, parseDate, parseDecimal, parseInteger } from '../parsing/values';
import {
  ACADEMIC_OPTIONAL_COLUMNS,
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
  credits: number | null;
  processScore: number | null;
  examScore: number | null;
  finalScore: number | null;
  letterGrade: LetterGrade | null;
  passed: boolean | null;
  resultStatus: CourseResultStatus;
  /** `YYYY-MM-DD` hoặc null (= lúc nạp). */
  publishedAt: string | null;
}

const PASS_ALIASES: Record<string, boolean> = {
  dat: true,
  khong_dat: false,
};

type Failure = ParsedRow<CourseResultRow> & { ok: false };
const invalid = (detail: string): Failure => ({ ok: false, reason: 'INVALID_FORMAT', detail });

const SCORE_COLUMNS = [
  ['diem_qua_trinh', 'Điểm quá trình', 'processScore'],
  ['diem_thi', 'Điểm thi', 'examScore'],
  ['diem_tong_ket', 'Điểm tổng kết', 'finalScore'],
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

/** Phần cuối kỳ: điểm chữ (từ nguồn, hoặc quy đổi từ điểm tổng kết), đạt/không đạt, cảnh báo lệch. */
function parseFinalPart(
  record: Readonly<Record<string, string>>,
  finalScore: number | null,
):
  | { ok: true; letter: LetterGrade | null; passed: boolean | null; warnings: RowWarning[] }
  | Failure {
  const letterText = (record.diem_chu ?? '').trim().toUpperCase();
  if (letterText && !isLetterGrade(letterText)) {
    return invalid(
      `Điểm chữ "${record.diem_chu}" không thuộc thang A+, A, B+, B, C+, C, D+, D, F.`,
    );
  }
  const resultText = labelKey(record.ket_qua ?? '');
  const passedFromFile = resultText ? PASS_ALIASES[resultText] : null;
  if (passedFromFile === undefined) return invalid('Kết quả phải là Đạt hoặc Không đạt.');

  const warnings: RowWarning[] = [];
  const derived = finalScore !== null ? letterFromScore(finalScore) : null;
  const letter = (letterText || null) as LetterGrade | null;
  if (letter && derived && letter !== derived) {
    warnings.push({
      code: 'LETTER_GRADE_MISMATCH',
      message: `Điểm chữ ${letter} lệch điểm tổng kết ${finalScore} (theo thang là ${derived}) — đã nạp theo điểm chữ của file.`,
    });
  }
  const finalLetter = letter ?? derived;
  const passedFromLetter = finalLetter ? isPassingLetter(finalLetter) : null;
  if (passedFromFile !== null && passedFromLetter !== null && passedFromFile !== passedFromLetter) {
    warnings.push({
      code: 'RESULT_MISMATCH',
      message: `Kết quả "${record.ket_qua}" lệch điểm chữ ${finalLetter} — đã nạp theo cột kết quả.`,
    });
  }
  return {
    ok: true,
    letter: finalLetter,
    passed: passedFromFile ?? passedFromLetter,
    warnings,
  };
}

function sameValues(a: CourseResult, row: CourseResultRow): boolean {
  return (
    a.processScore === row.processScore &&
    a.examScore === row.examScore &&
    a.finalScore === row.finalScore &&
    a.letterGrade === row.letterGrade &&
    a.passed === row.passed &&
    a.resultStatus === row.resultStatus &&
    (row.publishedAt === null || a.publishedAt.getTime() === vnMidnight(row.publishedAt).getTime())
  );
}

const vnMidnight = (date: string) => new Date(`${date}T00:00:00+07:00`);

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
  for (const row of rows) if (row.credits !== null) credits.set(row.courseId, row.credits);
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
 * Kết quả FINAL → `attemptOutcome` + `COMPLETED`; outcome đổi → tính lại lần học các học kỳ sau
 * trong CÙNG transaction để thứ tự nạp file không làm sai COMB-02 (docs/rules/10).
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
 * Kết quả học phần (docs/rules/10, 12): giữa kỳ chỉ có điểm quá trình → PROCESS_ONLY; có điểm
 * tổng kết / điểm chữ / kết quả → FINAL. KHÔNG chuyển FINAL về PROCESS_ONLY. KHÔNG ghi
 * `Student.officialAcademicStatus`.
 */
export const courseResultImport: ImportTypeDefinition<CourseResultRow> = {
  dataType: 'COURSE_RESULT',
  label: 'Kết quả học phần',
  requiresTerm: true,
  requiredColumns: [
    'mssv',
    'ma_hoc_phan',
    'ten_hoc_phan',
    'so_tin_chi',
    'diem_qua_trinh',
    'diem_thi',
    'diem_tong_ket',
    'diem_chu',
    'ket_qua',
  ],
  optionalColumns: ['ngay_cong_bo', ...ACADEMIC_OPTIONAL_COLUMNS],
  templatePath: '/templates/mau_ket_qua_hoc_phan.csv',

  parseRow(record, { decimalComma }) {
    const base = parseAcademicBase(record);
    if (!base.ok) return invalid(base.detail);
    const creditsText = (record.so_tin_chi ?? '').trim();
    const credits = creditsText ? parseInteger(creditsText) : null;
    if (credits && !credits.ok) return invalid(`Số tín chỉ: ${credits.message}`);
    if (credits?.ok && (credits.value < 1 || credits.value > 30)) {
      return { ok: false, reason: 'OUT_OF_RANGE', detail: 'Số tín chỉ phải từ 1 đến 30.' };
    }
    const scores = parseScores(record, decimalComma);
    if (!scores.ok) return scores;
    const final = parseFinalPart(record, scores.value.finalScore);
    if (!final.ok) return final;
    const publishedText = (record.ngay_cong_bo ?? '').trim();
    const published = publishedText ? parseDate(publishedText) : null;
    if (published && !published.ok) return invalid(`Ngày công bố: ${published.message}`);

    const isFinal = scores.value.finalScore !== null || final.passed !== null;
    if (!isFinal && scores.value.processScore === null) {
      return invalid('Dòng chưa có điểm nào (cần điểm quá trình, hoặc điểm tổng kết/kết quả).');
    }
    return {
      ok: true,
      value: {
        ...base.value,
        ...scores.value,
        credits: credits?.ok ? credits.value : null,
        letterGrade: final.letter,
        passed: isFinal ? final.passed : null,
        resultStatus: isFinal ? CourseResultStatus.FINAL : CourseResultStatus.PROCESS_ONLY,
        publishedAt: published?.ok ? published.value : null,
      },
      warnings: final.warnings,
    };
  },

  uniqueKeys: (row) => [pairKey(row)],

  async checkReferences(rows, em, batch) {
    const errors = await checkAcademicReferences(rows, em, batch);
    const existing = await findExistingResults(em, batch.termId ?? '', rows);
    rows.forEach((row, i) => {
      if (errors.has(i) || row.resultStatus !== CourseResultStatus.PROCESS_ONLY) return;
      if (existing.get(pairKey(row))?.resultStatus === CourseResultStatus.FINAL) {
        errors.set(i, {
          reason: 'RESULT_ALREADY_FINAL',
          detail: `${row.studentId} · ${row.courseId} đã có kết quả cuối kỳ — không nhận lại điểm giữa kỳ.`,
        });
      }
    });
    return errors;
  },

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
        finalScore: row.finalScore,
        letterGrade: row.letterGrade,
        passed: row.passed,
        resultStatus: row.resultStatus,
      };
      if (row.resultStatus === CourseResultStatus.FINAL) finals.push({ enrollmentId, row });
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
