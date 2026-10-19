import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { ensureEnrollments } from '../services/enrollment-sync';
import { rollbackSourceRows } from '../services/source-rollback';
import { parseDate, parseDecimal, parseInteger } from '../parsing/values';
import {
  ACADEMIC_OPTIONAL_COLUMNS,
  ACADEMIC_REQUIRED_COLUMNS,
  type AcademicRowBase,
  checkAcademicReferences,
  isWithinTerm,
  pairKey,
  parseAcademicBase,
} from './academic-row';
import {
  type ImportTypeDefinition,
  type LoadResult,
  type ParsedRow,
  type RowWarning,
} from './definition';

export interface AttendanceRow extends AcademicRowBase {
  /** `YYYY-MM-DD` — lưu 00:00 giờ Việt Nam. */
  snapshotDate: string;
  totalPeriods: number;
  excusedAbsence: number;
  unexcusedAbsence: number;
}

const COUNT_COLUMNS = [
  ['tong_so_tiet', 'Tổng số tiết', 'totalPeriods'],
  ['vang_co_phep', 'Số tiết vắng có phép', 'excusedAbsence'],
  ['vang_khong_phep', 'Số tiết vắng không phép', 'unexcusedAbsence'],
] as const;

type CountField = (typeof COUNT_COLUMNS)[number][2];

/** Tỷ lệ vắng trong file lệch số tính lại quá mức này (điểm %) → cảnh báo. */
const RATE_TOLERANCE = 0.5;

const vnMidnight = (date: string) => new Date(`${date}T00:00:00+07:00`);

const fail = (
  reason: 'INVALID_FORMAT' | 'OUT_OF_RANGE',
  detail: string,
): ParsedRow<AttendanceRow> => ({ ok: false, reason, detail });

function parseCounts(
  record: Readonly<Record<string, string>>,
): { ok: true; value: Record<CountField, number> } | ParsedRow<AttendanceRow> {
  const counts = {} as Record<CountField, number>;
  for (const [column, label, field] of COUNT_COLUMNS) {
    const value = parseInteger(record[column] ?? '');
    if (!value.ok) return fail('INVALID_FORMAT', `${label}: ${value.message}`);
    if (value.value < 0) return fail('OUT_OF_RANGE', `${label} không được âm.`);
    counts[field] = value.value;
  }
  return { ok: true, value: counts };
}

/** Cột `ty_le_vang` (tùy chọn, `22,22` hoặc `22,22 %`) chỉ để đối chiếu với số tính lại. */
function rateWarning(
  raw: string | undefined,
  c: Record<CountField, number>,
  decimalComma: boolean,
): RowWarning | null {
  const text = (raw ?? '').replace('%', '').trim();
  if (!text) return null;
  const given = parseDecimal(text, decimalComma || text.includes(','));
  const computed = ((c.excusedAbsence + c.unexcusedAbsence) * 100) / c.totalPeriods;
  if (given.ok && Math.abs(given.value - computed) <= RATE_TOLERANCE) return null;
  return {
    code: 'ABSENCE_RATE_MISMATCH',
    message: `Tỷ lệ vắng trong file "${raw}" khác số tính lại ${computed.toFixed(2)}% — hệ thống dùng số tiết.`,
  };
}

function sameValues(a: AttendanceSummary, row: AttendanceRow): boolean {
  return (
    a.totalPeriods === row.totalPeriods &&
    a.excusedAbsence === row.excusedAbsence &&
    a.unexcusedAbsence === row.unexcusedAbsence &&
    a.sectionCode === row.sectionCode
  );
}

/**
 * Điểm danh tổng hợp theo ngày chốt, đơn vị TIẾT (docs/rules/10, 12). Upsert theo (Enrollment,
 * ngày chốt): nạp lại cùng ngày chốt = cập nhật; ngày chốt khác = bản ghi mới.
 */
export const attendanceImport: ImportTypeDefinition<AttendanceRow> = {
  dataType: 'ATTENDANCE_SUMMARY',
  label: 'Điểm danh',
  requiresTerm: true,
  requiredColumns: [
    ...ACADEMIC_REQUIRED_COLUMNS,
    'ten_hoc_phan',
    'ngay_chot',
    'tong_so_tiet',
    'vang_co_phep',
    'vang_khong_phep',
  ],
  optionalColumns: [...ACADEMIC_OPTIONAL_COLUMNS, 'ty_le_vang'],
  templatePath: '/templates/mau_diem_danh.csv',

  parseRow(record, { decimalComma }) {
    const base = parseAcademicBase(record);
    if (!base.ok) return fail('INVALID_FORMAT', base.detail);
    const date = parseDate(record.ngay_chot ?? '');
    if (!date.ok) return fail('INVALID_FORMAT', `Ngày chốt: ${date.message}`);
    const counts = parseCounts(record);
    if (!counts.ok) return counts;
    const c = counts.value;
    if (c.totalPeriods < 1 || c.totalPeriods > 500) {
      return fail('OUT_OF_RANGE', 'Tổng số tiết phải từ 1 đến 500.');
    }
    if (c.excusedAbsence + c.unexcusedAbsence > c.totalPeriods) {
      return fail(
        'OUT_OF_RANGE',
        `Số tiết vắng (${c.excusedAbsence + c.unexcusedAbsence}) vượt tổng số tiết (${c.totalPeriods}).`,
      );
    }
    const warning = rateWarning(record.ty_le_vang, c, decimalComma);
    return {
      ok: true,
      value: { ...base.value, ...c, snapshotDate: date.value },
      warnings: warning ? [warning] : [],
    };
  },

  uniqueKeys: (row) => [`${pairKey(row)}|${row.snapshotDate}`],

  checkReferences(rows, em, batch, warn) {
    return checkAcademicReferences(rows, em, batch, warn, (row, term) =>
      isWithinTerm(vnMidnight(row.snapshotDate), term)
        ? null
        : {
            reason: 'TERM_MISMATCH',
            detail: `Ngày chốt ${row.snapshotDate} nằm ngoài thời gian ${term.termName}.`,
          },
    );
  },

  describe: (row) => ({
    courseId: row.courseId,
    courseName: row.courseName,
    derivedCode: row.derivedCode,
    sectionCode: row.sectionCode,
    studentId: row.studentId,
    totalPeriods: row.totalPeriods,
    snapshotDate: row.snapshotDate,
  }),

  async load(rows, em, batch) {
    const enrollments = await ensureEnrollments(em, batch, rows);
    const existing = await em.find(AttendanceSummary, {
      where: { enrollmentId: In([...new Set(enrollments.values())]) },
    });
    const byKey = new Map(
      existing.map((a) => [`${a.enrollmentId}|${a.snapshotDate.toISOString()}`, a]),
    );
    const result: LoadResult = { inserted: 0, updated: 0, unchanged: 0, createdKeys: [] };
    const inserts: Partial<AttendanceSummary>[] = [];

    for (const row of rows) {
      const enrollmentId = enrollments.get(pairKey(row)) ?? '';
      const snapshotDate = vnMidnight(row.snapshotDate);
      const values = {
        totalPeriods: row.totalPeriods,
        excusedAbsence: row.excusedAbsence,
        unexcusedAbsence: row.unexcusedAbsence,
        sectionCode: row.sectionCode,
      };
      const current = byKey.get(`${enrollmentId}|${snapshotDate.toISOString()}`);
      if (!current) {
        const id = randomUUID();
        inserts.push({ id, enrollmentId, snapshotDate, ...values, importBatchId: batch.id });
        result.createdKeys.push(id);
      } else if (sameValues(current, row)) {
        result.unchanged += 1;
      } else {
        await em.update(
          AttendanceSummary,
          { id: current.id },
          { ...values, importBatchId: batch.id },
        );
        result.updated += 1;
      }
    }
    if (inserts.length > 0) await em.insert(AttendanceSummary, inserts);
    result.inserted = inserts.length;
    return result;
  },

  async rollback(createdKeys, em, batch) {
    const outcome = await rollbackSourceRows(AttendanceSummary, createdKeys, em, batch);
    return 'blocked' in outcome ? outcome.blocked : null;
  },
};
