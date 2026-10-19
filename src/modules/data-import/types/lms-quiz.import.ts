import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { LmsActivityType, QuizAttemptStatus } from '@/db/enums';
import { ensureEnrollments } from '../services/enrollment-sync';
import {
  type ActivityRef,
  activityKeyOf,
  activityRefKey,
  deleteOrphanActivities,
  dueDateChangeMessage,
  ensureActivities,
  findActivities,
  parseDueAt,
} from '../services/lms-activities';
import { rollbackSourceRows } from '../services/source-rollback';
import {
  hasLostDiacritics,
  labelKey,
  LOST_DIACRITICS_HINT,
  parseDateTime,
  parseDecimal,
  parseInteger,
  parseMinutes,
  parseScore,
} from '../parsing/values';
import {
  ACADEMIC_OPTIONAL_COLUMNS,
  ACADEMIC_REQUIRED_COLUMNS,
  type AcademicRowBase,
  checkAcademicReferences,
  isWithinTerm,
  pairKey,
  parseAcademicBase,
} from './academic-row';
import { type ImportTypeDefinition, type LoadResult, type ParsedRow } from './definition';

/** Dòng "Chưa làm": không tạo lượt làm, chỉ cho biết sinh viên có trong lớp và bài tồn tại. */
export const NOT_STARTED = 'NOT_STARTED';

export interface LmsQuizRow extends AcademicRowBase {
  activityKey: string;
  activityName: string;
  /** ISO có múi giờ +07:00. */
  dueAt: string | null;
  /** NULL → đánh số theo thứ tự thời điểm bắt đầu trong file. */
  attemptNumber: number | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationMinutes: number | null;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  status: QuizAttemptStatus | typeof NOT_STARTED;
}

/** Trạng thái — mã chuẩn, nhãn tiếng Việt hoặc nhãn Moodle (docs/rules/12). */
const STATUS_ALIASES: Record<string, LmsQuizRow['status']> = {
  submitted: QuizAttemptStatus.SUBMITTED,
  da_nop: QuizAttemptStatus.SUBMITTED,
  finished: QuizAttemptStatus.SUBMITTED,
  da_hoan_thanh: QuizAttemptStatus.SUBMITTED,
  in_progress: QuizAttemptStatus.IN_PROGRESS,
  dang_lam: QuizAttemptStatus.IN_PROGRESS,
  abandoned: QuizAttemptStatus.ABANDONED,
  bo_do: QuizAttemptStatus.ABANDONED,
  not_started: NOT_STARTED,
  chua_lam: NOT_STARTED,
  never_submitted: NOT_STARTED,
};

type Failure = ParsedRow<LmsQuizRow> & { ok: false };
const invalid = (detail: string): Failure => ({ ok: false, reason: 'INVALID_FORMAT', detail });
const outOfRange = (detail: string): Failure => ({ ok: false, reason: 'OUT_OF_RANGE', detail });

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

function parseQuestions(
  record: Readonly<Record<string, string>>,
): { ok: true; correct: number | null; total: number | null } | Failure {
  const correct = optional(record.so_cau_dung, parseInteger);
  if (!correct.ok) return invalid(`Số câu đúng: ${correct.message}`);
  const total = optional(record.tong_so_cau, parseInteger);
  if (!total.ok) return invalid(`Tổng số câu: ${total.message}`);
  if (total.value !== null && total.value < 1) return outOfRange('Tổng số câu phải lớn hơn 0.');
  if (correct.value !== null && (correct.value < 0 || correct.value > (total.value ?? Infinity))) {
    return outOfRange(`Số câu đúng ${correct.value} phải từ 0 đến tổng số câu.`);
  }
  return { ok: true, correct: correct.value, total: total.value };
}

/** Phần lượt làm (bỏ qua với dòng "Chưa làm"). */
function parseAttempt(
  record: Readonly<Record<string, string>>,
  status: LmsQuizRow['status'],
  decimalComma: boolean,
):
  | Failure
  | {
      ok: true;
      value: Omit<
        LmsQuizRow,
        keyof AcademicRowBase | 'activityKey' | 'activityName' | 'dueAt' | 'status'
      >;
    } {
  const empty = {
    attemptNumber: null,
    startedAt: null,
    submittedAt: null,
    durationMinutes: null,
    score: null,
    maxScore: null,
    correctCount: null,
    totalQuestions: null,
  };
  if (status === NOT_STARTED) return { ok: true, value: empty };
  const attempt = optional(record.lan_lam, parseInteger);
  if (!attempt.ok) return invalid(`Lần làm: ${attempt.message}`);
  if (attempt.value !== null && attempt.value < 1) return outOfRange('Lần làm bắt đầu từ 1.');
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
  const questions = parseQuestions(record);
  if (!questions.ok) return questions;
  if (submittedAt.value && new Date(submittedAt.value) < new Date(startedAt.value)) {
    return outOfRange('Thời điểm nộp trước thời điểm bắt đầu.');
  }
  if (status === QuizAttemptStatus.SUBMITTED && (!submittedAt.value || scores.score === null)) {
    return invalid('Bài đã nộp phải có thời điểm nộp và điểm.');
  }
  return {
    ok: true,
    value: {
      attemptNumber: attempt.value,
      startedAt: startedAt.value,
      submittedAt: submittedAt.value,
      durationMinutes: duration.value,
      score: scores.score,
      maxScore: scores.maxScore,
      correctCount: questions.correct,
      totalQuestions: questions.total,
    },
  };
}

function activityRef(row: LmsQuizRow): ActivityRef {
  return {
    courseId: row.courseId,
    sectionCode: row.sectionCode,
    activityType: LmsActivityType.QUIZ,
    activityKey: row.activityKey,
    activityName: row.activityName,
    dueAt: row.dueAt,
  };
}

/** Lần làm trống → đánh số theo thời điểm bắt đầu trong cùng (Enrollment, bài) của lô dòng. */
function numberAttempts(rows: readonly LmsQuizRow[]): Map<LmsQuizRow, number> {
  const groups = new Map<string, LmsQuizRow[]>();
  for (const row of rows) {
    if (row.status === NOT_STARTED || row.attemptNumber !== null) continue;
    const key = `${pairKey(row)}|${row.activityKey}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const numbers = new Map<LmsQuizRow, number>();
  for (const group of groups.values()) {
    group
      .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
      .forEach((row, i) => numbers.set(row, i + 1));
  }
  return numbers;
}

function sameValues(a: LmsQuizAttempt, row: LmsQuizRow): boolean {
  return (
    a.startedAt.getTime() === new Date(row.startedAt ?? '').getTime() &&
    (a.submittedAt?.getTime() ?? null) ===
      (row.submittedAt ? new Date(row.submittedAt).getTime() : null) &&
    a.durationMinutes === row.durationMinutes &&
    a.score === row.score &&
    a.maxScore === row.maxScore &&
    a.correctCount === row.correctCount &&
    a.totalQuestions === row.totalQuestions &&
    a.status === row.status
  );
}

/**
 * Bài trắc nghiệm LMS (docs/rules/10, 12). Mỗi bài = 1 `LmsActivity` QUIZ của lớp học phần;
 * lượt làm upsert theo (Enrollment, bài, lần làm) — file LMS xuất lũy kế nên nạp lại là cập nhật.
 */
export const lmsQuizImport: ImportTypeDefinition<LmsQuizRow> = {
  dataType: 'LMS_QUIZ',
  label: 'Bài trắc nghiệm LMS',
  requiresTerm: true,
  requiredColumns: [...ACADEMIC_REQUIRED_COLUMNS, 'ma_bai', 'ten_bai', 'trang_thai'],
  optionalColumns: [
    ...ACADEMIC_OPTIONAL_COLUMNS,
    'ten_hoc_phan',
    'han_nop',
    'lan_lam',
    'thoi_diem_bat_dau',
    'thoi_diem_nop',
    'thoi_gian_lam_phut',
    'diem',
    'diem_toi_da',
    'so_cau_dung',
    'tong_so_cau',
  ],
  templatePath: '/templates/mau_lms_trac_nghiem.csv',

  parseRow(record, { decimalComma }) {
    const base = parseAcademicBase(record);
    if (!base.ok) return invalid(base.detail);
    const activityName = (record.ten_bai ?? '').trim().replace(/\s+/g, ' ');
    const activityKey = activityKeyOf(record.ma_bai ?? '', activityName);
    if (!activityName || activityName.length > 200) return invalid('Tên bài từ 1 đến 200 ký tự.');
    if (hasLostDiacritics(activityName)) {
      return invalid(`Tên bài "${activityName}" ${LOST_DIACRITICS_HINT}`);
    }
    if (activityKey.length > 100) return invalid('Mã bài tối đa 100 ký tự.');
    const dueAt = optional(record.han_nop, parseDueAt);
    if (!dueAt.ok) return invalid(`Hạn nộp: ${dueAt.message}`);
    const status = STATUS_ALIASES[labelKey(record.trang_thai ?? '')];
    if (!status) return invalid('Trạng thái phải là: Đã nộp, Đang làm, Bỏ dở hoặc Chưa làm.');
    const attempt = parseAttempt(record, status, decimalComma);
    if (!attempt.ok) return attempt;
    return {
      ok: true,
      value: {
        ...base.value,
        activityKey,
        activityName,
        dueAt: dueAt.value,
        status,
        ...attempt.value,
      },
    };
  },

  uniqueKeys: (row) => [
    `${pairKey(row)}|${row.activityKey}|${row.status === NOT_STARTED ? NOT_STARTED : (row.attemptNumber ?? row.startedAt)}`,
  ],

  consistency: (row) => ({
    key: `${row.courseId}|${row.sectionCode}|${row.activityKey}`,
    value: row.dueAt ?? '',
    message: `Hạn nộp của bài "${row.activityName}" khác các dòng trước của cùng bài.`,
  }),

  async checkReferences(rows, em, batch, warn) {
    const existing = await findActivities(em, batch.termId ?? '', rows.map(activityRef));
    const errors = await checkAcademicReferences(rows, em, batch, warn, (row, term) =>
      !row.startedAt || isWithinTerm(new Date(row.startedAt), term)
        ? null
        : {
            reason: 'TERM_MISMATCH',
            detail: `Thời điểm bắt đầu làm bài nằm ngoài thời gian ${term.termName}.`,
          },
    );
    const warned = new Set<string>();
    rows.forEach((row, i) => {
      const current = existing.get(activityRefKey(activityRef(row)));
      const message = current ? dueDateChangeMessage(current, activityRef(row)) : null;
      if (message && !errors.has(i) && !warned.has(current?.id ?? '')) {
        warned.add(current?.id ?? '');
        warn(i, { code: 'DUE_DATE_CHANGED', message });
      }
    });
    return errors;
  },

  describe: (row) => ({
    courseId: row.courseId,
    courseName: row.courseName,
    derivedCode: row.derivedCode,
    sectionCode: row.sectionCode,
    studentId: row.studentId,
    activity: { key: row.activityKey, name: row.activityName, dueAt: row.dueAt },
  }),

  async load(rows, em, batch) {
    const enrollments = await ensureEnrollments(em, batch, rows);
    const activities = await ensureActivities(em, batch, rows.map(activityRef));
    const existing = await em.find(LmsQuizAttempt, {
      where: { enrollmentId: In([...new Set(enrollments.values())]) },
    });
    const byKey = new Map(
      existing.map((a) => [`${a.enrollmentId}|${a.activityId}|${a.attemptNumber}`, a]),
    );
    const numbers = numberAttempts(rows);
    const result: LoadResult = {
      inserted: 0,
      updated: activities.updated,
      unchanged: 0,
      createdKeys: [],
    };
    const inserts: Partial<LmsQuizAttempt>[] = [];

    for (const row of rows) {
      if (row.status === NOT_STARTED) continue;
      const enrollmentId = enrollments.get(pairKey(row)) ?? '';
      const activityId = activities.ids.get(activityRefKey(activityRef(row))) ?? '';
      const attemptNumber = row.attemptNumber ?? numbers.get(row) ?? 1;
      const values = {
        startedAt: new Date(row.startedAt ?? ''),
        submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
        durationMinutes: row.durationMinutes,
        score: row.score,
        maxScore: row.maxScore,
        correctCount: row.correctCount,
        totalQuestions: row.totalQuestions,
        status: row.status,
      };
      const current = byKey.get(`${enrollmentId}|${activityId}|${attemptNumber}`);
      if (!current) {
        const id = randomUUID();
        inserts.push({
          id,
          enrollmentId,
          activityId,
          attemptNumber,
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
    if ('blocked' in outcome) return outcome.blocked;
    await deleteOrphanActivities(em, batch.id);
    return null;
  },
};
