import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { ensureEnrollments } from '../services/enrollment-sync';
import { rollbackSourceRows } from '../services/source-rollback';
import { parseDate, parseInteger } from '../parsing/values';
import {
  ACADEMIC_OPTIONAL_COLUMNS,
  type AcademicRowBase,
  checkAcademicReferences,
  isWithinTerm,
  pairKey,
  parseAcademicBase,
} from './academic-row';
import { type ImportTypeDefinition, type LoadResult, type ParsedRow } from './definition';

export interface AttendanceRow extends AcademicRowBase {
  /** `YYYY-MM-DD` — lưu 00:00 giờ Việt Nam. */
  snapshotDate: string;
  totalSessions: number;
  plannedSessions: number | null;
  present: number;
  late: number;
  excusedAbsence: number;
  unexcusedAbsence: number;
  sectionCode: string | null;
}

const COUNT_COLUMNS = [
  ['tong_buoi', 'Tổng số buổi đã học', 'totalSessions'],
  ['co_mat', 'Có mặt', 'present'],
  ['di_tre', 'Đi trễ', 'late'],
  ['vang_co_phep', 'Vắng có phép', 'excusedAbsence'],
  ['vang_khong_phep', 'Vắng không phép', 'unexcusedAbsence'],
] as const;

type CountField = (typeof COUNT_COLUMNS)[number][2];

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

function sameValues(a: AttendanceSummary, row: AttendanceRow): boolean {
  return (
    a.totalSessions === row.totalSessions &&
    a.plannedSessions === row.plannedSessions &&
    a.present === row.present &&
    a.late === row.late &&
    a.excusedAbsence === row.excusedAbsence &&
    a.unexcusedAbsence === row.unexcusedAbsence &&
    a.sectionCode === row.sectionCode
  );
}

/**
 * Điểm danh tổng hợp theo ngày chốt (docs/rules/10, 12). Upsert theo (Enrollment, ngày chốt):
 * nạp lại cùng ngày chốt = cập nhật; ngày chốt khác = bản ghi mới, KHÔNG đụng ngày khác.
 */
export const attendanceImport: ImportTypeDefinition<AttendanceRow> = {
  dataType: 'ATTENDANCE_SUMMARY',
  label: 'Điểm danh tổng hợp',
  requiresTerm: true,
  requiredColumns: [
    'mssv',
    'ma_hoc_phan',
    'ten_hoc_phan',
    'ngay_chot',
    'tong_buoi',
    'co_mat',
    'di_tre',
    'vang_co_phep',
    'vang_khong_phep',
  ],
  optionalColumns: ['tong_buoi_ke_hoach', 'ma_lop_hoc_phan', ...ACADEMIC_OPTIONAL_COLUMNS],
  templatePath: '/templates/mau_diem_danh_tong_hop.csv',

  parseRow(record) {
    const base = parseAcademicBase(record);
    if (!base.ok) return fail('INVALID_FORMAT', base.detail);
    const date = parseDate(record.ngay_chot ?? '');
    if (!date.ok) return fail('INVALID_FORMAT', `Ngày chốt: ${date.message}`);
    const counts = parseCounts(record);
    if (!counts.ok) return counts;
    const plannedText = (record.tong_buoi_ke_hoach ?? '').trim();
    const planned = plannedText ? parseInteger(plannedText) : null;
    if (planned && !planned.ok) {
      return fail('INVALID_FORMAT', `Tổng số buổi kế hoạch: ${planned.message}`);
    }
    const sectionCode = (record.ma_lop_hoc_phan ?? '').trim() || null;
    if (sectionCode && sectionCode.length > 30) {
      return fail('INVALID_FORMAT', 'Mã lớp học phần tối đa 30 ký tự.');
    }

    const c = counts.value;
    if (c.present + c.late + c.excusedAbsence + c.unexcusedAbsence > c.totalSessions) {
      return fail(
        'OUT_OF_RANGE',
        `Có mặt + đi trễ + vắng (${c.present + c.late + c.excusedAbsence + c.unexcusedAbsence}) vượt tổng số buổi đã học (${c.totalSessions}).`,
      );
    }
    const plannedSessions = planned?.ok ? planned.value : null;
    if (plannedSessions !== null && plannedSessions < c.totalSessions) {
      return fail(
        'OUT_OF_RANGE',
        `Tổng số buổi kế hoạch (${plannedSessions}) nhỏ hơn số buổi đã học (${c.totalSessions}).`,
      );
    }
    return {
      ok: true,
      value: { ...base.value, ...c, snapshotDate: date.value, plannedSessions, sectionCode },
    };
  },

  uniqueKeys: (row) => [`${pairKey(row)}|${row.snapshotDate}`],

  checkReferences(rows, em, batch) {
    return checkAcademicReferences(rows, em, batch, (row, term) =>
      isWithinTerm(vnMidnight(row.snapshotDate), term)
        ? null
        : {
            reason: 'TERM_MISMATCH',
            detail: `Ngày chốt ${row.snapshotDate} nằm ngoài thời gian ${term.termName}.`,
          },
    );
  },

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
        totalSessions: row.totalSessions,
        plannedSessions: row.plannedSessions,
        present: row.present,
        late: row.late,
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
