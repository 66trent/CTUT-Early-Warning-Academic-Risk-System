import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { LmsAssignmentSubmission } from '@/db/entities/lms-assignment-submission.entity';
import { LmsActivityType, SubmissionStatus } from '@/db/enums';
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
} from '../parsing/values';
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

export interface LmsAssignmentRow extends AcademicRowBase {
  activityKey: string;
  activityName: string;
  /** ISO có múi giờ +07:00 — bắt buộc với bài thực hành. */
  dueAt: string;
  status: SubmissionStatus;
  submittedAt: string | null;
}

/** Trạng thái nộp — mã chuẩn, nhãn tiếng Việt hoặc nhãn Moodle (docs/rules/12). */
const STATUS_ALIASES: Record<string, SubmissionStatus> = {
  on_time: SubmissionStatus.ON_TIME,
  da_nop: SubmissionStatus.ON_TIME,
  submitted_for_grading: SubmissionStatus.ON_TIME,
  late: SubmissionStatus.LATE,
  nop_tre: SubmissionStatus.LATE,
  not_submitted: SubmissionStatus.NOT_SUBMITTED,
  chua_nop: SubmissionStatus.NOT_SUBMITTED,
  no_submission: SubmissionStatus.NOT_SUBMITTED,
};

type Failure = ParsedRow<LmsAssignmentRow> & { ok: false };
const invalid = (detail: string): Failure => ({ ok: false, reason: 'INVALID_FORMAT', detail });

function activityRef(row: LmsAssignmentRow): ActivityRef {
  return {
    courseId: row.courseId,
    sectionCode: row.sectionCode,
    activityType: LmsActivityType.ASSIGNMENT,
    activityKey: row.activityKey,
    activityName: row.activityName,
    dueAt: row.dueAt,
  };
}

/** Trạng thái trong file lệch thời điểm nộp so với hạn → cảnh báo, nạp theo thời điểm nộp. */
function statusWarning(row: Omit<LmsAssignmentRow, keyof AcademicRowBase>): RowWarning | null {
  if (!row.submittedAt) return null;
  const late = new Date(row.submittedAt) > new Date(row.dueAt);
  if (late === (row.status === SubmissionStatus.LATE)) return null;
  return {
    code: 'SUBMISSION_STATUS_MISMATCH',
    message: `Bài "${row.activityName}" ghi "${late ? 'Đã nộp' : 'Nộp trễ'}" nhưng thời điểm nộp ${late ? 'sau' : 'trước'} hạn — hệ thống tính theo thời điểm nộp.`,
  };
}

function sameValues(a: LmsAssignmentSubmission, row: LmsAssignmentRow): boolean {
  return (
    a.status === row.status &&
    (a.submittedAt?.getTime() ?? null) ===
      (row.submittedAt ? new Date(row.submittedAt).getTime() : null)
  );
}

/**
 * Trạng thái nộp bài thực hành LMS (docs/rules/10, 12) — chỉ trạng thái, không điểm (giảng viên
 * có thể chưa chấm). Upsert theo (Enrollment, bài): nạp lại cập nhật (Chưa nộp → Nộp trễ).
 */
export const lmsAssignmentImport: ImportTypeDefinition<LmsAssignmentRow> = {
  dataType: 'LMS_ASSIGNMENT',
  label: 'Bài thực hành LMS',
  requiresTerm: true,
  requiredColumns: [...ACADEMIC_REQUIRED_COLUMNS, 'ma_bai', 'ten_bai', 'han_nop', 'trang_thai_nop'],
  optionalColumns: [...ACADEMIC_OPTIONAL_COLUMNS, 'ten_hoc_phan', 'thoi_diem_nop'],
  templatePath: '/templates/mau_lms_thuc_hanh.csv',

  parseRow(record) {
    const base = parseAcademicBase(record);
    if (!base.ok) return invalid(base.detail);
    const activityName = (record.ten_bai ?? '').trim().replace(/\s+/g, ' ');
    const activityKey = activityKeyOf(record.ma_bai ?? '', activityName);
    if (!activityName || activityName.length > 200) return invalid('Tên bài từ 1 đến 200 ký tự.');
    if (hasLostDiacritics(activityName)) {
      return invalid(`Tên bài "${activityName}" ${LOST_DIACRITICS_HINT}`);
    }
    if (activityKey.length > 100) return invalid('Mã bài tối đa 100 ký tự.');
    const dueAt = parseDueAt(record.han_nop ?? '');
    if (!dueAt.ok) return invalid(`Hạn nộp: ${dueAt.message}`);
    const status = STATUS_ALIASES[labelKey(record.trang_thai_nop ?? '')];
    if (!status) return invalid('Trạng thái nộp phải là: Đã nộp, Nộp trễ hoặc Chưa nộp.');
    const submittedText = (record.thoi_diem_nop ?? '').trim();
    const submittedAt = submittedText ? parseDateTime(submittedText) : null;
    if (submittedAt && !submittedAt.ok) return invalid(`Thời điểm nộp: ${submittedAt.message}`);
    if (status !== SubmissionStatus.NOT_SUBMITTED && !submittedAt) {
      return invalid('Bài đã nộp phải có thời điểm nộp.');
    }
    const value = {
      activityKey,
      activityName,
      dueAt: dueAt.value,
      status,
      submittedAt: status === SubmissionStatus.NOT_SUBMITTED ? null : (submittedAt?.value ?? null),
    };
    const warning = statusWarning(value);
    return { ok: true, value: { ...base.value, ...value }, warnings: warning ? [warning] : [] };
  },

  uniqueKeys: (row) => [`${pairKey(row)}|${row.activityKey}`],

  consistency: (row) => ({
    key: `${row.courseId}|${row.sectionCode}|${row.activityKey}`,
    value: row.dueAt,
    message: `Hạn nộp của bài "${row.activityName}" khác các dòng trước của cùng bài.`,
  }),

  async checkReferences(rows, em, batch, warn) {
    const existing = await findActivities(em, batch.termId ?? '', rows.map(activityRef));
    const errors = await checkAcademicReferences(rows, em, batch, warn);
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
    const existing = await em.find(LmsAssignmentSubmission, {
      where: { enrollmentId: In([...new Set(enrollments.values())]) },
    });
    const byKey = new Map(existing.map((s) => [`${s.enrollmentId}|${s.activityId}`, s]));
    const result: LoadResult = {
      inserted: 0,
      updated: activities.updated,
      unchanged: 0,
      createdKeys: [],
    };
    const inserts: Partial<LmsAssignmentSubmission>[] = [];

    for (const row of rows) {
      const enrollmentId = enrollments.get(pairKey(row)) ?? '';
      const activityId = activities.ids.get(activityRefKey(activityRef(row))) ?? '';
      const values = {
        status: row.status,
        submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
      };
      const current = byKey.get(`${enrollmentId}|${activityId}`);
      if (!current) {
        const id = randomUUID();
        inserts.push({ id, enrollmentId, activityId, ...values, importBatchId: batch.id });
        result.createdKeys.push(id);
      } else if (sameValues(current, row)) {
        result.unchanged += 1;
      } else {
        await em.update(
          LmsAssignmentSubmission,
          { id: current.id },
          { ...values, importBatchId: batch.id },
        );
        result.updated += 1;
      }
    }
    if (inserts.length > 0) await em.insert(LmsAssignmentSubmission, inserts);
    result.inserted = inserts.length;
    return result;
  },

  async rollback(createdKeys, em, batch) {
    const outcome = await rollbackSourceRows(LmsAssignmentSubmission, createdKeys, em, batch);
    if ('blocked' in outcome) return outcome.blocked;
    await deleteOrphanActivities(em, batch.id);
    return null;
  },
};
