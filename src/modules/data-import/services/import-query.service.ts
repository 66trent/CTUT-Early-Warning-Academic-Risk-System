import { getDataSource } from '@/db/data-source';
import { Course } from '@/db/entities/course.entity';
import { ImportBatch, type ImportCourseCard } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Term } from '@/db/entities/term.entity';
import { type ImportBatchStatus, IMPORT_DATA_TYPES } from '@/db/enums';
import {
  findOrder,
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
  warnings: { row: number; code: string; message: string }[];
  stagedAt: string | null;
  completedAt: string | null;
}

export interface ImportErrorRowDto {
  sourceRowNumber: number;
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

function toListItem(batch: ImportBatch): ImportBatchListItemDto {
  return {
    id: batch.id,
    dataType: batch.dataType,
    dataTypeLabel: labelOf(batch.dataType),
    termName: batch.term?.termName ?? null,
    fileName: batch.fileName,
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
}

export async function listImportBatches(
  filter: BatchFilter = {},
  list: ListParams<BatchSortKey> = firstPage(BATCH_DEFAULT_SORT),
): Promise<Paged<ImportBatchListItemDto>> {
  const repo = (await getDataSource()).getRepository(ImportBatch);
  const dataType = IMPORT_DATA_TYPES.find((t) => t === filter.dataType);
  const [batches, total] = await repo.findAndCount({
    where: dataType ? { dataType } : {},
    relations: { term: true },
    order: findOrder(
      resolveSort(list, BATCH_DEFAULT_SORT).sort,
      resolveSort(list, BATCH_DEFAULT_SORT).dir,
      'createdAt',
    ),
    skip: pageOffset(list),
    take: list.size,
  });
  return { items: batches.map(toListItem), total, page: list.page, size: list.size };
}

export async function getImportBatchDetail(batchId: string): Promise<ImportBatchDetailDto | null> {
  const batch = await (
    await getDataSource()
  )
    .getRepository(ImportBatch)
    .findOne({ where: { id: batchId }, relations: { term: true } });
  if (!batch) return null;
  const summary = readSummary(batch.summary);
  const rollback = await getRollbackEligibility(batch);
  const preview = summary.preview ?? [];
  return {
    ...toListItem(batch),
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
      code: w.code,
      message: w.message,
    })),
    stagedAt: batch.stagedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
  };
}

/** Dòng lỗi của 1 lô theo thứ tự dòng trong file. */
export async function listErrorRows(
  batchId: string,
  list: ListParams = firstPage({ size: 50 }),
): Promise<Paged<ImportErrorRowDto>> {
  const [rows, total] = await (await getDataSource()).getRepository(ImportErrorRow).findAndCount({
    select: { sourceRowNumber: true, errorReason: true, errorDetail: true, rawData: true },
    where: { importBatchId: batchId },
    order: { sourceRowNumber: 'ASC' },
    skip: pageOffset(list),
    take: list.size,
  });
  return {
    items: rows.map((r) => ({
      sourceRowNumber: r.sourceRowNumber,
      errorReason: r.errorReason,
      errorDetail: r.errorDetail,
      rawData: { ...r.rawData },
    })),
    total,
    page: list.page,
    size: list.size,
  };
}
