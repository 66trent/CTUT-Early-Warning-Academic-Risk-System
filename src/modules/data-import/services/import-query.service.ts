import { getDataSource } from '@/db/data-source';
import { Course } from '@/db/entities/course.entity';
import { ImportBatchFile } from '@/db/entities/import-batch-file.entity';
import { ImportBatch, type ImportCourseCard } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Term } from '@/db/entities/term.entity';
import { type ImportBatchStatus, IMPORT_DATA_TYPES } from '@/db/enums';
import {
  applyOrder,
  firstPage,
  type ListParams,
  type Paged,
  pageOffset,
  resolveSort,
} from '@/lib/list-params';
import { availableImportTypes, getImportDefinition } from '../types/registry';
import { getRollbackEligibility, isBatchBusy } from './import-batch.service';
import { HIGH_ERROR_RATE, readSummary, readWarnings } from './import-summary';

export const BATCH_SORT_KEYS = ['createdAt', 'dataType', 'status', 'fileName'] as const;
export type BatchSortKey = (typeof BATCH_SORT_KEYS)[number];
export const BATCH_DEFAULT_SORT = { sort: 'createdAt', dir: 'desc' } as const;

export interface ImportBatchListItemDto {
  id: string;
  dataType: string;
  dataTypeLabel: string;
  termName: string | null;
  fileName: string;
  /** Số file của lô (Phase 8f — nạp nhiều file 1 lần). */
  fileCount: number;
  /** Học phần của lô (1 học phần → tên; nhiều → "N học phần"; chưa đọc → null). */
  courseLabel: string | null;
  status: ImportBatchStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
  performedBy: string;
  createdAt: string;
}

export interface ImportBatchDetailDto extends ImportBatchListItemDto {
  termId: string | null;
  errorMessage: string | null;
  parentBatchId: string | null;
  confirmed: boolean;
  busy: boolean;
  highErrorRate: boolean;
  preview: Record<string, string>[];
  previewHeaders: string[];
  /** Header gốc theo thứ tự file — để bảng lỗi hiện đúng thứ tự cột. */
  columns: string[] | null;
  inserted: number | null;
  updated: number | null;
  unchanged: number | null;
  rollback: { allowed: boolean; reason: string | null };
  /** Học phần Admin chọn khi nạp (null = tự nhận diện từ file). */
  selectedCourseId: string | null;
  /** Thẻ nhận diện từng học phần trong file (docs/rules/12). */
  courses: ImportCourseCard[];
  /** Cảnh báo không chặn nạp (VD điểm chữ lệch điểm tổng kết). */
  warnings: { row: number; file: string | null; code: string; message: string }[];
  stagedAt: string | null;
  completedAt: string | null;
  /** Các file của lô theo thứ tự tải lên. */
  files: ImportBatchFileDto[];
}

export interface ImportBatchFileDto {
  fileName: string;
  sizeBytes: number;
  totalRows: number;
  successRows: number;
  errorRows: number;
  courseIds: string[];
}

export interface ImportErrorRowDto {
  sourceRowNumber: number;
  /** Tên file chứa dòng (null ở lô cũ trước Phase 8f). */
  sourceFileName: string | null;
  errorReason: string;
  errorDetail: string | null;
  rawData: Record<string, string>;
}

export interface ImportFormOptionsDto {
  types: { dataType: string; label: string; requiresTerm: boolean; templatePath: string }[];
  terms: { termId: string; termName: string; isCurrent: boolean }[];
  /** Học phần đã có trong hệ thống — chọn (tùy chọn) khi nạp file của 1 học phần. */
  courses: { courseId: string; courseName: string }[];
}

function labelOf(dataType: string): string {
  return getImportDefinition(dataType)?.label ?? dataType;
}

function courseLabelOf(batch: ImportBatch): string | null {
  const cards = readSummary(batch.summary).courses ?? [];
  if (cards.length === 1) return cards[0]?.courseName ?? null;
  if (cards.length > 1) return `${cards.length} học phần`;
  return batch.courseId;
}

function toListItem(batch: ImportBatch, fileCount = 1): ImportBatchListItemDto {
  return {
    id: batch.id,
    dataType: batch.dataType,
    dataTypeLabel: labelOf(batch.dataType),
    termName: batch.term?.termName ?? null,
    fileName: batch.fileName,
    fileCount,
    courseLabel: courseLabelOf(batch),
    status: batch.status,
    totalRows: batch.totalRows,
    successRows: batch.successRows,
    errorRows: batch.errorRows,
    performedBy: batch.performedBy,
    createdAt: batch.createdAt.toISOString(),
  };
}

/** Lựa chọn cho form nhập: loại dữ liệu + học kỳ CHƯA chốt (hiện tại lên đầu). */
export async function getImportFormOptions(): Promise<ImportFormOptionsDto> {
  const ds = await getDataSource();
  const [terms, courses] = await Promise.all([
    ds.getRepository(Term).find({
      select: { termId: true, termName: true, isCurrent: true, closedAt: true, startDate: true },
      order: { isCurrent: 'DESC', startDate: 'DESC' },
      take: 50,
    }),
    ds.getRepository(Course).find({
      select: { courseId: true, courseName: true },
      order: { courseName: 'ASC' },
      take: 1000,
    }),
  ]);
  return {
    types: availableImportTypes(),
    terms: terms
      .filter((t) => !t.closedAt)
      .map((t) => ({ termId: t.termId, termName: t.termName, isCurrent: t.isCurrent })),
    courses: courses.map((c) => ({ courseId: c.courseId, courseName: c.courseName })),
  };
}

export interface BatchFilter {
  dataType?: string;
  /** Học phần chọn trên form hoặc nhận diện trong file (`summary.courses`). */
  courseId?: string;
  /** Khoa của lớp sinh hoạt trong thẻ học phần. */
  departmentId?: string;
}

const BATCH_SORT_COLUMNS: Record<BatchSortKey, string> = {
  createdAt: 'b.createdAt',
  dataType: 'b.dataType',
  status: 'b.status',
  fileName: 'b.fileName',
};

async function countFiles(batchIds: string[]): Promise<Map<string, number>> {
  if (batchIds.length === 0) return new Map();
  const rows = await (
    await getDataSource()
  )
    .getRepository(ImportBatchFile)
    .createQueryBuilder('f')
    .select('f.import_batch_id', 'id')
    .addSelect('COUNT(*)', 'n')
    .where('f.import_batch_id IN (:...batchIds)', { batchIds })
    .groupBy('f.import_batch_id')
    .getRawMany<{ id: string; n: string }>();
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
}

/** Lịch sử nạp: lọc loại / học phần / khoa (docs/rules/12), phân trang + sắp xếp ở server. */
export async function listImportBatches(
  filter: BatchFilter = {},
  list: ListParams<BatchSortKey> = firstPage(BATCH_DEFAULT_SORT),
): Promise<Paged<ImportBatchListItemDto>> {
  const qb = (await getDataSource())
    .getRepository(ImportBatch)
    .createQueryBuilder('b')
    .leftJoinAndSelect('b.term', 'term');
  const dataType = IMPORT_DATA_TYPES.find((t) => t === filter.dataType);
  if (dataType) qb.andWhere('b.data_type = :dataType', { dataType });
  if (filter.courseId) {
    qb.andWhere("(b.course_id = :courseId OR b.summary->'courses' @> CAST(:courseJson AS jsonb))", {
      courseId: filter.courseId,
      courseJson: JSON.stringify([{ courseId: filter.courseId }]),
    });
  }
  if (filter.departmentId) {
    qb.andWhere("b.summary->'courses' @> CAST(:deptJson AS jsonb)", {
      deptJson: JSON.stringify([{ classes: [{ departmentId: filter.departmentId }] }]),
    });
  }
  const { sort, dir } = resolveSort(list, BATCH_DEFAULT_SORT);
  applyOrder(qb, BATCH_SORT_COLUMNS[sort], dir, ['b.createdAt', 'DESC'], ['b.id', 'ASC']);
  const [batches, total] = await qb.skip(pageOffset(list)).take(list.size).getManyAndCount();
  const files = await countFiles(batches.map((b) => b.id));
  return {
    items: batches.map((b) => toListItem(b, files.get(b.id) ?? 1)),
    total,
    page: list.page,
    size: list.size,
  };
}

/** Lựa chọn bộ lọc lịch sử nạp: học phần + khoa có trong hệ thống. */
export async function getBatchFilterOptions(): Promise<{
  courses: { courseId: string; courseName: string }[];
  departments: { departmentId: string; departmentName: string }[];
}> {
  const ds = await getDataSource();
  const [courses, departments] = await Promise.all([
    ds.getRepository(Course).find({
      select: { courseId: true, courseName: true },
      order: { courseName: 'ASC' },
      take: 1000,
    }),
    ds.query<{ department_id: string; department_name: string }[]>(
      'SELECT department_id, department_name FROM departments ORDER BY department_name',
    ),
  ]);
  return {
    courses: courses.map((c) => ({ courseId: c.courseId, courseName: c.courseName })),
    departments: departments.map((d) => ({
      departmentId: d.department_id,
      departmentName: d.department_name,
    })),
  };
}

export async function getImportBatchDetail(batchId: string): Promise<ImportBatchDetailDto | null> {
  const batch = await (
    await getDataSource()
  )
    .getRepository(ImportBatch)
    .findOne({ where: { id: batchId }, relations: { term: true } });
  if (!batch) return null;
  const summary = readSummary(batch.summary);
  const [rollback, files] = await Promise.all([
    getRollbackEligibility(batch),
    (await getDataSource()).getRepository(ImportBatchFile).find({
      where: { importBatchId: batchId },
      order: { fileOrder: 'ASC' },
    }),
  ]);
  const preview = summary.preview ?? [];
  return {
    ...toListItem(batch, Math.max(1, files.length)),
    termId: batch.termId,
    errorMessage: batch.errorMessage,
    parentBatchId: batch.parentBatchId,
    confirmed: Boolean(summary.confirmedAt),
    busy: isBatchBusy(batch),
    highErrorRate: (summary.errorRate ?? 0) > HIGH_ERROR_RATE,
    preview,
    previewHeaders: summary.columns ?? (preview[0] ? Object.keys(preview[0]) : []),
    columns: summary.columns ?? null,
    inserted: summary.inserted ?? null,
    updated: summary.updated ?? null,
    unchanged: summary.unchanged ?? null,
    rollback: { allowed: rollback.allowed, reason: rollback.allowed ? null : rollback.reason },
    selectedCourseId: batch.courseId,
    courses: (summary.courses ?? []).map((c) => ({
      ...c,
      sectionCodes: [...c.sectionCodes],
      classes: c.classes.map((x) => ({ ...x })),
      ...(c.snapshotDates ? { snapshotDates: [...c.snapshotDates] } : {}),
      ...(c.activities ? { activities: c.activities.map((a) => ({ ...a })) } : {}),
      ...(c.publishedDates ? { publishedDates: [...c.publishedDates] } : {}),
    })),
    warnings: readWarnings(batch.warnings).map((w) => ({
      row: w.row,
      file: w.file ?? null,
      code: w.code,
      message: w.message,
    })),
    stagedAt: batch.stagedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    files: files.map((f) => ({
      fileName: f.fileName,
      sizeBytes: f.sizeBytes,
      totalRows: f.totalRows,
      successRows: f.successRows,
      errorRows: f.errorRows,
      courseIds: [...f.courseIds],
    })),
  };
}

/** Dòng lỗi của 1 lô theo thứ tự file (thứ tự tải lên) rồi thứ tự dòng trong file. */
export async function listErrorRows(
  batchId: string,
  list: ListParams = firstPage({ size: 50 }),
): Promise<Paged<ImportErrorRowDto>> {
  const [rows, total] = await (
    await getDataSource()
  )
    .getRepository(ImportErrorRow)
    .createQueryBuilder('r')
    .leftJoin(
      ImportBatchFile,
      'f',
      'f.import_batch_id = r.import_batch_id AND f.file_name = r.source_file_name',
    )
    .where('r.import_batch_id = :batchId', { batchId })
    .orderBy('f.file_order', 'ASC', 'NULLS FIRST')
    .addOrderBy('r.source_row_number', 'ASC')
    .offset(pageOffset(list))
    .limit(list.size)
    .getManyAndCount();
  return {
    items: rows.map((r) => ({
      sourceRowNumber: r.sourceRowNumber,
      sourceFileName: r.sourceFileName,
      errorReason: r.errorReason,
      errorDetail: r.errorDetail,
      rawData: { ...r.rawData },
    })),
    total,
    page: list.page,
    size: list.size,
  };
}
