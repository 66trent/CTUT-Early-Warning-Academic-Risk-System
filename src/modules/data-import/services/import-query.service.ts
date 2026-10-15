import { getDataSource } from '@/db/data-source';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Term } from '@/db/entities/term.entity';
import { type ImportBatchStatus, IMPORT_DATA_TYPES } from '@/db/enums';
import { availableImportTypes, getImportDefinition } from '../types/registry';
import { getRollbackEligibility, isBatchBusy } from './import-batch.service';
import { HIGH_ERROR_RATE, readSummary } from './import-summary';

export const BATCHES_PAGE_SIZE = 20;
export const ERROR_ROWS_PAGE_SIZE = 50;

export interface ImportBatchListItemDto {
  id: string;
  dataType: string;
  dataTypeLabel: string;
  termName: string | null;
  fileName: string;
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
}

function labelOf(dataType: string): string {
  return getImportDefinition(dataType)?.label ?? dataType;
}

function toListItem(batch: ImportBatch): ImportBatchListItemDto {
  return {
    id: batch.id,
    dataType: batch.dataType,
    dataTypeLabel: labelOf(batch.dataType),
    termName: batch.term?.termName ?? null,
    fileName: batch.fileName,
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
  const terms = await (await getDataSource()).getRepository(Term).find({
    select: { termId: true, termName: true, isCurrent: true, closedAt: true, startDate: true },
    order: { isCurrent: 'DESC', startDate: 'DESC' },
    take: 50,
  });
  return {
    types: availableImportTypes(),
    terms: terms
      .filter((t) => !t.closedAt)
      .map((t) => ({ termId: t.termId, termName: t.termName, isCurrent: t.isCurrent })),
  };
}

export interface BatchFilter {
  dataType?: string;
  page: number;
}

export async function listImportBatches(
  filter: BatchFilter,
): Promise<{ items: ImportBatchListItemDto[]; total: number }> {
  const repo = (await getDataSource()).getRepository(ImportBatch);
  const dataType = IMPORT_DATA_TYPES.find((t) => t === filter.dataType);
  const [batches, total] = await repo.findAndCount({
    where: dataType ? { dataType } : {},
    relations: { term: true },
    order: { createdAt: 'DESC' },
    skip: (filter.page - 1) * BATCHES_PAGE_SIZE,
    take: BATCHES_PAGE_SIZE,
  });
  return { items: batches.map(toListItem), total };
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
    stagedAt: batch.stagedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
  };
}

export async function listErrorRows(batchId: string, page: number): Promise<ImportErrorRowDto[]> {
  const rows = await (await getDataSource()).getRepository(ImportErrorRow).find({
    select: { sourceRowNumber: true, errorReason: true, errorDetail: true, rawData: true },
    where: { importBatchId: batchId },
    order: { sourceRowNumber: 'ASC' },
    skip: (page - 1) * ERROR_ROWS_PAGE_SIZE,
    take: ERROR_ROWS_PAGE_SIZE,
  });
  return rows.map((r) => ({
    sourceRowNumber: r.sourceRowNumber,
    errorReason: r.errorReason,
    errorDetail: r.errorDetail,
    rawData: { ...r.rawData },
  }));
}
