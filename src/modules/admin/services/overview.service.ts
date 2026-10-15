import { In, IsNull } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Alert } from '@/db/entities/alert.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { RiskScoreLog } from '@/db/entities/risk-score-log.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import {
  AlertStatus,
  DataCompletenessLevel,
  EvaluationRunStatus,
  ImportBatchStatus,
  type Severity,
  SEVERITY_ORDER,
} from '@/db/enums';
import { getImportDefinition } from '@/modules/data-import/types/registry';

/** Cảnh báo còn cần Cố vấn học tập theo dõi (chưa đóng). */
export const ACTIVE_ALERT_STATUSES: readonly AlertStatus[] = [
  AlertStatus.OPEN,
  AlertStatus.REOPENED,
  AlertStatus.ACKNOWLEDGED,
  AlertStatus.IN_PROGRESS,
];
const RECENT_BATCHES = 10;
const INSUFFICIENT_LIST_LIMIT = 20;

export interface AdminOverviewDto {
  currentTerm: { termId: string; termName: string } | null;
  totals: { students: number; classes: number; activeAlerts: number; insufficient: number | null };
  studentsByClass: { classId: string; students: number }[];
  /** Cảnh báo chưa đóng của học kỳ hiện tại theo mức — CRITICAL trước (docs/rules/03). */
  alertsBySeverity: { severity: Severity; count: number }[];
  importQuality: {
    id: string;
    fileName: string;
    dataTypeLabel: string;
    status: ImportBatchStatus;
    totalRows: number;
    errorRows: number;
    /** Tỷ lệ dòng lỗi 0–1; null khi lô không có dòng nào. */
    errorRate: number | null;
    createdAt: string;
  }[];
  /** Lần chạy đánh giá cả học kỳ gần nhất đã xong — nguồn số sinh viên chưa đủ dữ liệu. */
  lastRun: { id: string; asOf: string; finishedAt: string | null } | null;
  insufficientStudents: { studentId: string; fullName: string; classId: string }[];
}

/** Sĩ số theo lớp — COUNT … GROUP BY tường minh (docs/rules/01). */
async function countStudentsByClass(): Promise<{ classId: string; students: number }[]> {
  const ds = await getDataSource();
  const rows = await ds
    .getRepository(AdministrativeClass)
    .createQueryBuilder('c')
    .leftJoin(Student, 's', 's.classId = c.classId')
    .select('c.classId', 'classId')
    .addSelect('COUNT(s.studentId)', 'students')
    .groupBy('c.classId')
    .orderBy('c.classId', 'ASC')
    .getRawMany<{ classId: string; students: string }>();
  return rows.map((r) => ({ classId: r.classId, students: Number(r.students) }));
}

async function countAlertsBySeverity(termId: string): Promise<Map<Severity, number>> {
  const rows = await (
    await getDataSource()
  )
    .getRepository(Alert)
    .createQueryBuilder('a')
    .select('a.severity', 'severity')
    .addSelect('COUNT(*)', 'count')
    .where('a.termId = :termId', { termId })
    .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_ALERT_STATUSES })
    .groupBy('a.severity')
    .getRawMany<{ severity: Severity; count: string }>();
  return new Map(rows.map((r) => [r.severity, Number(r.count)]));
}

async function recentImportQuality(): Promise<AdminOverviewDto['importQuality']> {
  const batches = await (await getDataSource()).getRepository(ImportBatch).find({
    where: {
      status: In([
        ImportBatchStatus.STAGED,
        ImportBatchStatus.RECONCILED,
        ImportBatchStatus.REJECTED,
        ImportBatchStatus.ROLLED_BACK,
      ]),
    },
    order: { createdAt: 'DESC' },
    take: RECENT_BATCHES,
  });
  return batches.map((b) => ({
    id: b.id,
    fileName: b.fileName,
    dataTypeLabel: getImportDefinition(b.dataType)?.label ?? b.dataType,
    status: b.status,
    totalRows: b.totalRows,
    errorRows: b.errorRows,
    errorRate: b.totalRows > 0 ? b.errorRows / b.totalRows : null,
    createdAt: b.createdAt.toISOString(),
  }));
}

/** Sinh viên `INSUFFICIENT` ở lần chạy cả học kỳ gần nhất đã xong (docs/rules/07). */
async function insufficientFromLastRun(termId: string) {
  const ds = await getDataSource();
  const run = await ds.getRepository(EvaluationRun).findOne({
    where: { termId, courseId: IsNull(), status: EvaluationRunStatus.COMPLETED },
    order: { createdAt: 'DESC' },
  });
  if (!run) return { run: null, count: null, students: [] };
  const [logs, count] = await ds.getRepository(RiskScoreLog).findAndCount({
    select: { studentId: true },
    where: { evaluationRunId: run.id, dataCompletenessLevel: DataCompletenessLevel.INSUFFICIENT },
    order: { studentId: 'ASC' },
    take: INSUFFICIENT_LIST_LIMIT,
  });
  const students = await ds.getRepository(Student).find({
    select: { studentId: true, fullName: true, classId: true },
    where: { studentId: In(logs.map((l) => l.studentId)) },
    order: { studentId: 'ASC' },
  });
  return {
    run: {
      id: run.id,
      asOf: run.asOf.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    },
    count,
    students: students.map((s) => ({
      studentId: s.studentId,
      fullName: s.fullName,
      classId: s.classId,
    })),
  };
}

/** Số liệu trang Tổng quan Admin — chỉ số tổng hợp, không trả dữ liệu thô (docs/rules/05). */
export async function getAdminOverview(): Promise<AdminOverviewDto> {
  const ds = await getDataSource();
  const term = await ds.getRepository(Term).findOneBy({ isCurrent: true });
  const [studentsByClass, studentCount, importQuality] = await Promise.all([
    countStudentsByClass(),
    ds.getRepository(Student).count(),
    recentImportQuality(),
  ]);
  const severities = term ? await countAlertsBySeverity(term.termId) : new Map<Severity, number>();
  const insufficient = term
    ? await insufficientFromLastRun(term.termId)
    : { run: null, count: null, students: [] };
  return {
    currentTerm: term ? { termId: term.termId, termName: term.termName } : null,
    totals: {
      students: studentCount,
      classes: studentsByClass.length,
      activeAlerts: [...severities.values()].reduce((a, b) => a + b, 0),
      insufficient: insufficient.count,
    },
    studentsByClass,
    alertsBySeverity: [...SEVERITY_ORDER]
      .reverse()
      .map((severity) => ({ severity, count: severities.get(severity) ?? 0 })),
    importQuality,
    lastRun: insufficient.run,
    insufficientStudents: insufficient.students,
  };
}
