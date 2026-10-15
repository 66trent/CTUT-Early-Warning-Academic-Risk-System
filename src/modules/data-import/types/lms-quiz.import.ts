import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { QuizAttemptStatus } from '@/db/enums';
import { ensureEnrollments } from '../services/enrollment-sync';
import { rollbackSourceRows } from '../services/source-rollback';
import {
  labelKey,
  parseDateTime,
  parseDecimal,
  parseInteger,
  parseMinutes,
  parseScore,
  stripDiacritics,
} from '../parsing/values';
import {
  ACADEMIC_OPTIONAL_COLUMNS,
  type AcademicRowBase,
  checkAcademicReferences,
  isWithinTerm,
  pairKey,
  parseAcademicBase,
} from './academic-row';
import { type ImportTypeDefinition, type LoadResult, type ParsedRow } from './definition';

export interface LmsQuizRow extends AcademicRowBase {
  quizKey: string;
  quizName: string;
  attemptNumber: number;
  /** ISO có múi giờ +07:00. */
  startedAt: string;
  submittedAt: string | null;
  durationMinutes: number | null;
  score: number | null;
  maxScore: number | null;
  status: QuizAttemptStatus;
  sectionCode: string | null;
}

/** Trạng thái LMS — mã chuẩn hoặc nhãn tiếng Việt (docs/rules/12). */
const STATUS_ALIASES: Record<string, QuizAttemptStatus> = {
  submitted: QuizAttemptStatus.SUBMITTED,
  da_nop: QuizAttemptStatus.SUBMITTED,
  in_progress: QuizAttemptStatus.IN_PROGRESS,
  dang_lam: QuizAttemptStatus.IN_PROGRESS,
  abandoned: QuizAttemptStatus.ABANDONED,
  bo_do: QuizAttemptStatus.ABANDONED,
};

type Failure = ParsedRow<LmsQuizRow> & { ok: false };
const invalid = (detail: string): Failure => ({ ok: false, reason: 'INVALID_FORMAT', detail });
const outOfRange = (detail: string): Failure => ({ ok: false, reason: 'OUT_OF_RANGE', detail });

/** `ma_bai`; trống thì tên bài bỏ dấu, chữ thường, gộp khoảng trắng (docs/rules/10). */
function quizKeyOf(code: string, name: string): string {
  const trimmed = code.trim();
  if (trimmed) return trimmed.toUpperCase();
  return stripDiacritics(name).trim().replace(/\s+/g, ' ');
}

function optional<T>(
  raw: string | undefined,
  parse: (text: string) => { ok: true; value: T } | { ok: false; message: string },
): { ok: true; value: T | null } | { ok: false; message: string } {
  const text = (raw ?? '').trim();
  return text ? parse(text) : { ok: true, value: null };
}

function parseScores(
  record: Readonly<Record<string, string>>,
  decimalComma: boolean,
): { ok: true; score: number | null; maxScore: number | null } | Failure {
  const score = optional(record.diem, (t) => parseScore(t, decimalComma));
  if (!score.ok) return invalid(score.message);
  const max = optional(record.diem_toi_da, (t) => parseDecimal(t, decimalComma));
  if (!max.ok) return invalid(`Điểm tối đa: ${max.message}`);
  const embeddedMax = score.value?.maxScore ?? null;
  if (embeddedMax !== null && max.value !== null && embeddedMax !== max.value) {
    return invalid(`Điểm "${record.diem}" khác điểm tối đa ${max.value}.`);
  }
  const maxScore = max.value ?? embeddedMax;
  const value = score.value?.score ?? null;
  if (maxScore !== null && maxScore <= 0) return outOfRange('Điểm tối đa phải lớn hơn 0.');
  if (value !== null && (value < 0 || (maxScore !== null && value > maxScore))) {
    return outOfRange(`Điểm ${value} phải trong khoảng 0 đến ${maxScore ?? 'điểm tối đa'}.`);
  }
  return { ok: true, score: value, maxScore };
}

function sameValues(a: LmsQuizAttempt, row: LmsQuizRow): boolean {
  return (
    a.quizName === row.quizName &&
    a.startedAt.getTime() === new Date(row.startedAt).getTime() &&
    (a.submittedAt?.getTime() ?? null) ===
      (row.submittedAt ? new Date(row.submittedAt).getTime() : null) &&
    a.durationMinutes === row.durationMinutes &&
    a.score === row.score &&
    a.maxScore === row.maxScore &&
    a.status === row.status &&
    a.sectionCode === row.sectionCode
  );
}

/**
 * Kết quả làm bài kiểm tra LMS (docs/rules/10, 12). Upsert theo (Enrollment, bài, lần làm) —
 * file LMS xuất lũy kế nên nạp lại cùng lượt là cập nhật (VD đang làm → đã nộp).
 */
export const lmsQuizImport: ImportTypeDefinition<LmsQuizRow> = {
  dataType: 'LMS_QUIZ',
  label: 'Bài kiểm tra LMS',
  requiresTerm: true,
  requiredColumns: [
    'mssv',
    'ma_hoc_phan',
    'ma_bai',
    'ten_bai',
    'lan_lam',
    'thoi_diem_bat_dau',
    'thoi_diem_nop',
    'thoi_gian_lam_phut',
    'diem',
    'diem_toi_da',
    'trang_thai',
  ],
  optionalColumns: ['ma_lop_hoc_phan', 'ten_hoc_phan', ...ACADEMIC_OPTIONAL_COLUMNS],
  templatePath: '/templates/mau_lms_bai_kiem_tra.csv',

  parseRow(record, { decimalComma }) {
    const base = parseAcademicBase(record);
    if (!base.ok) return invalid(base.detail);
    const quizName = (record.ten_bai ?? '').trim().replace(/\s+/g, ' ');
    const quizKey = quizKeyOf(record.ma_bai ?? '', quizName);
    if (!quizName || quizName.length > 200) return invalid('Tên bài từ 1 đến 200 ký tự.');
    if (quizKey.length > 100) return invalid('Mã bài tối đa 100 ký tự.');
    const attempt = parseInteger(record.lan_lam ?? '');
    if (!attempt.ok) return invalid(`Lần làm: ${attempt.message}`);
    if (attempt.value < 1) return outOfRange('Lần làm bắt đầu từ 1.');
    const startedAt = parseDateTime(record.thoi_diem_bat_dau ?? '');
    if (!startedAt.ok) return invalid(`Thời điểm bắt đầu: ${startedAt.message}`);
    const submittedAt = optional(record.thoi_diem_nop, parseDateTime);
    if (!submittedAt.ok) return invalid(`Thời điểm nộp: ${submittedAt.message}`);
    const duration = optional(record.thoi_gian_lam_phut, (t) => parseMinutes(t, decimalComma));
    if (!duration.ok) return invalid(duration.message);
    if (duration.value !== null && duration.value < 0) {
      return outOfRange('Thời gian làm bài không được âm.');
    }
    const scores = parseScores(record, decimalComma);
    if (!scores.ok) return scores;
    const status = STATUS_ALIASES[labelKey(record.trang_thai ?? '')];
    if (!status) return invalid('Trạng thái phải là: Đã nộp, Đang làm hoặc Bỏ dở.');
    if (submittedAt.value && new Date(submittedAt.value) < new Date(startedAt.value)) {
      return outOfRange('Thời điểm nộp trước thời điểm bắt đầu.');
    }
    if (status === QuizAttemptStatus.SUBMITTED && (!submittedAt.value || scores.score === null)) {
      return invalid('Bài đã nộp phải có thời điểm nộp và điểm.');
    }
    const sectionCode = (record.ma_lop_hoc_phan ?? '').trim() || null;
    if (sectionCode && sectionCode.length > 30) return invalid('Mã lớp học phần tối đa 30 ký tự.');
    return {
      ok: true,
      value: {
        ...base.value,
        quizKey,
        quizName,
        attemptNumber: attempt.value,
        startedAt: startedAt.value,
        submittedAt: submittedAt.value,
        durationMinutes: duration.value,
        score: scores.score,
        maxScore: scores.maxScore,
        status,
        sectionCode,
      },
    };
  },

  uniqueKeys: (row) => [`${pairKey(row)}|${row.quizKey}|${row.attemptNumber}`],

  checkReferences(rows, em, batch) {
    return checkAcademicReferences(rows, em, batch, (row, term) =>
      isWithinTerm(new Date(row.startedAt), term)
        ? null
        : {
            reason: 'TERM_MISMATCH',
            detail: `Thời điểm bắt đầu làm bài nằm ngoài thời gian ${term.termName}.`,
          },
    );
  },

  async load(rows, em, batch) {
    const enrollments = await ensureEnrollments(em, batch, rows);
    const existing = await em.find(LmsQuizAttempt, {
      where: { enrollmentId: In([...new Set(enrollments.values())]) },
    });
    const byKey = new Map(
      existing.map((a) => [`${a.enrollmentId}|${a.quizKey}|${a.attemptNumber}`, a]),
    );
    const result: LoadResult = { inserted: 0, updated: 0, unchanged: 0, createdKeys: [] };
    const inserts: Partial<LmsQuizAttempt>[] = [];

    for (const row of rows) {
      const enrollmentId = enrollments.get(pairKey(row)) ?? '';
      const values = {
        quizName: row.quizName,
        startedAt: new Date(row.startedAt),
        submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
        durationMinutes: row.durationMinutes,
        score: row.score,
        maxScore: row.maxScore,
        status: row.status,
        sectionCode: row.sectionCode,
      };
      const current = byKey.get(`${enrollmentId}|${row.quizKey}|${row.attemptNumber}`);
      if (!current) {
        const id = randomUUID();
        inserts.push({
          id,
          enrollmentId,
          quizKey: row.quizKey,
          attemptNumber: row.attemptNumber,
          ...values,
          importBatchId: batch.id,
        });
        result.createdKeys.push(id);
      } else if (sameValues(current, row)) {
        result.unchanged += 1;
      } else {
        await em.update(LmsQuizAttempt, { id: current.id }, { ...values, importBatchId: batch.id });
        result.updated += 1;
      }
    }
    if (inserts.length > 0) await em.insert(LmsQuizAttempt, inserts);
    result.inserted = inserts.length;
    return result;
  },

  async rollback(createdKeys, em, batch) {
    const outcome = await rollbackSourceRows(LmsQuizAttempt, createdKeys, em, batch);
    return 'blocked' in outcome ? outcome.blocked : null;
  },
};
