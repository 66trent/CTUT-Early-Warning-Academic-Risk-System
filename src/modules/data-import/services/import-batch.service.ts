import { createHash, randomUUID } from 'node:crypto';
import { In, LessThan, MoreThan, IsNull, Not } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Term } from '@/db/entities/term.entity';
import { ImportBatchStatus, ImportSource } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { requestAutoEvaluation } from '@/modules/rule-engine/services/evaluation-run.service';
import { FileRejectedError } from '../parsing/errors';
import { sniffImportFile } from '../parsing/file-sniff';
import { getImportDefinition } from '../types/registry';
import { type ImportEnqueuer, enqueueImportJob } from './import-queue';
import { readSummary, writeSummary } from './import-summary';

export const STAGED_TTL_DAYS = 7;
const LIVE_STATUSES = [
  ImportBatchStatus.UPLOADING,
  ImportBatchStatus.VALIDATING,
  ImportBatchStatus.STAGED,
  ImportBatchStatus.LOADED,
  ImportBatchStatus.RECONCILED,
];

export interface CreateImportInput {
  dataType: string;
  termId: string | null;
  parentBatchId: string | null;
  fileName: string;
  data: Buffer;
}

function safeObjectName(fileName: string): string {
  const base = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_');
  return base.slice(-100) || 'file';
}

/**
 * Tạo lô nhập: kiểm tra file (đuôi + nội dung + dung lượng) → chống nạp trùng → lưu file gốc
 * MinIO → lô VALIDATING → job kiểm tra. Lỗi cả file báo ngay, không tạo lô.
 */
export async function createImportBatch(
  input: CreateImportInput,
  actorId: string,
  enqueue: ImportEnqueuer = enqueueImportJob,
): Promise<{ batchId: string }> {
  const def = getImportDefinition(input.dataType);
  if (!def) throw new AppError('INVALID_TYPE', 'Loại dữ liệu chưa được hỗ trợ.');
  try {
    sniffImportFile(input.fileName, input.data);
  } catch (error) {
    if (error instanceof FileRejectedError) throw new AppError('FILE_REJECTED', error.message);
    throw error;
  }

  const dataSource = await getDataSource();
  const termId = def.requiresTerm ? input.termId : null;
  if (def.requiresTerm) {
    const term = termId ? await dataSource.getRepository(Term).findOneBy({ termId }) : null;
    if (!term) throw new AppError('TERM_REQUIRED', 'Chọn học kỳ cho dữ liệu này.');
    if (term.closedAt)
      throw new AppError('TERM_CLOSED', `${term.termName} đã chốt, không nhận thêm dữ liệu.`);
  }

  const checksum = createHash('sha256').update(input.data).digest('hex');
  const duplicate = await dataSource.getRepository(ImportBatch).findOne({
    select: { id: true, createdAt: true },
    where: {
      sourceChecksum: checksum,
      dataType: input.dataType,
      termId: termId ?? IsNull(),
      status: In(LIVE_STATUSES),
    },
  });
  if (duplicate) {
    throw new AppError(
      'DUPLICATE_FILE',
      'File này đã được nạp trước đó. Nếu cần nạp lại, hãy hủy hoặc hoàn tác lô cũ.',
    );
  }

  const id = randomUUID();
  const objectKey = `imports/${new Date().getFullYear()}/${id}/${safeObjectName(input.fileName)}`;
  await getStorage().put(objectKey, input.data, 'application/octet-stream');
  await dataSource.transaction(async (em) => {
    await em.insert(ImportBatch, {
      id,
      dataType: input.dataType,
      termId,
      source: ImportSource.FILE,
      fileName: input.fileName.slice(0, 255),
      sourceChecksum: checksum,
      performedBy: actorId,
      status: ImportBatchStatus.VALIDATING,
      parentBatchId: input.parentBatchId,
      originalFilePath: objectKey,
    });
    await writeAuditLog(
      {
        actorId,
        action: 'IMPORT_CREATED',
        targetType: 'ImportBatch',
        targetId: id,
        detail: {
          dataType: input.dataType,
          termId,
          fileName: input.fileName,
          parentBatchId: input.parentBatchId,
        },
      },
      em,
    );
  });
  await enqueue('validate', id);
  return { batchId: id };
}

async function findBatch(batchId: string): Promise<ImportBatch> {
  const batch = await (await getDataSource()).getRepository(ImportBatch).findOneBy({ id: batchId });
  if (!batch) throw new AppError('BATCH_NOT_FOUND', 'Không tìm thấy lô nhập.');
  return batch;
}

/** Admin xác nhận nạp lô STAGED → job nạp (kiểm tra lại toàn bộ khi nạp). */
export async function confirmImportBatch(
  batchId: string,
  actorId: string,
  enqueue: ImportEnqueuer = enqueueImportJob,
): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const batch = await em.findOne(ImportBatch, {
      where: { id: batchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!batch) throw new AppError('BATCH_NOT_FOUND', 'Không tìm thấy lô nhập.');
    const summary = readSummary(batch.summary);
    if (batch.status !== ImportBatchStatus.STAGED || summary.confirmedAt) {
      throw new AppError('INVALID_STATUS', 'Lô không còn ở trạng thái chờ xác nhận.');
    }
    await em.update(
      ImportBatch,
      { id: batchId },
      {
        summary: writeSummary({
          ...summary,
          confirmedAt: new Date().toISOString(),
          confirmedBy: actorId,
        }),
      },
    );
    await writeAuditLog(
      { actorId, action: 'IMPORT_CONFIRMED', targetType: 'ImportBatch', targetId: batchId },
      em,
    );
  });
  await enqueue('load', batchId);
}

/** Hủy lô STAGED chưa xác nhận (chưa ghi dữ liệu nghiệp vụ nào). */
export async function discardImportBatch(
  batchId: string,
  actorId: string | null,
  expired = false,
): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const batch = await em.findOne(ImportBatch, {
      where: { id: batchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!batch) throw new AppError('BATCH_NOT_FOUND', 'Không tìm thấy lô nhập.');
    if (batch.status !== ImportBatchStatus.STAGED || readSummary(batch.summary).confirmedAt) {
      throw new AppError('INVALID_STATUS', 'Chỉ hủy được lô đang chờ xác nhận.');
    }
    await em.update(
      ImportBatch,
      { id: batchId },
      { status: ImportBatchStatus.DISCARDED, completedAt: new Date() },
    );
    await writeAuditLog(
      {
        actorId,
        action: expired ? 'IMPORT_EXPIRED' : 'IMPORT_DISCARDED',
        targetType: 'ImportBatch',
        targetId: batchId,
      },
      em,
    );
  });
}

/** Tự hủy lô chờ xác nhận quá 7 ngày (job hằng ngày). Trả số lô đã hủy. */
export async function expireStagedBatches(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STAGED_TTL_DAYS * 24 * 3600 * 1000);
  const stale = await (await getDataSource()).getRepository(ImportBatch).find({
    select: { id: true, summary: true },
    where: { status: ImportBatchStatus.STAGED, stagedAt: LessThan(cutoff) },
    take: 500,
  });
  let expired = 0;
  for (const batch of stale) {
    if (readSummary(batch.summary).confirmedAt) continue;
    await discardImportBatch(batch.id, null, true);
    expired += 1;
  }
  return expired;
}

export type RollbackEligibility = { allowed: true } | { allowed: false; reason: string };

/**
 * Điều kiện hoàn tác lô (docs/rules/12). Người dùng bỏ điều kiện "chưa có EvaluationRun" (mỗi lô
 * nạp xong đều tự chạy đánh giá) — hoàn tác xong tự đánh giá lại.
 */
export async function getRollbackEligibility(batch: ImportBatch): Promise<RollbackEligibility> {
  if (batch.status !== ImportBatchStatus.LOADED && batch.status !== ImportBatchStatus.RECONCILED) {
    return { allowed: false, reason: 'Chỉ hoàn tác được lô đã nạp.' };
  }
  const summary = readSummary(batch.summary);
  if (summary.retried || summary.createdKeys === undefined) {
    return {
      allowed: false,
      reason: 'Lô đã phải nạp lại sau sự cố nên không xác định chắc dữ liệu đã tạo.',
    };
  }
  if ((summary.updated ?? 0) > 0) {
    return {
      allowed: false,
      reason: `Lô đã cập nhật ${summary.updated} dòng có sẵn — hoàn tác sẽ không trả lại giá trị cũ. Hãy nạp file đúng để sửa.`,
    };
  }
  const laterBatch = await (await getDataSource()).getRepository(ImportBatch).exists({
    where: {
      id: Not(batch.id),
      dataType: batch.dataType,
      termId: batch.termId ?? IsNull(),
      status: In([ImportBatchStatus.LOADED, ImportBatchStatus.RECONCILED]),
      loadedAt: MoreThan(batch.loadedAt ?? new Date(0)),
    },
  });
  if (laterBatch) {
    return {
      allowed: false,
      reason: 'Đã có lô cùng loại nạp sau lô này — dữ liệu có thể đã bị ghi đè.',
    };
  }
  return { allowed: true };
}

/** Hoàn tác lô có điều kiện: xóa đúng bản ghi lô đã tạo, trong 1 transaction, có Audit Log. */
export async function rollbackImportBatch(
  batchId: string,
  actorId: string,
  /** Sau hoàn tác lô học tập: đánh giá lại học kỳ (docs/rules/12). */
  afterRollback: (batch: ImportBatch) => Promise<unknown> = requestAutoEvaluation,
): Promise<void> {
  const batch = await findBatch(batchId);
  const eligibility = await getRollbackEligibility(batch);
  if (!eligibility.allowed) throw new AppError('ROLLBACK_NOT_ALLOWED', eligibility.reason);
  const def = getImportDefinition(batch.dataType);
  if (!def) throw new AppError('INVALID_TYPE', 'Loại dữ liệu chưa được hỗ trợ.');
  const createdKeys = readSummary(batch.summary).createdKeys ?? [];

  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const locked = await em.findOne(ImportBatch, {
      where: { id: batchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !locked ||
      (locked.status !== ImportBatchStatus.LOADED && locked.status !== ImportBatchStatus.RECONCILED)
    ) {
      throw new AppError('INVALID_STATUS', 'Trạng thái lô đã thay đổi, vui lòng tải lại trang.');
    }
    const blocked = await def.rollback(createdKeys, em, locked);
    if (blocked) throw new AppError('ROLLBACK_NOT_ALLOWED', blocked);
    await em.update(
      ImportBatch,
      { id: batchId },
      { status: ImportBatchStatus.ROLLED_BACK, completedAt: new Date() },
    );
    await writeAuditLog(
      {
        actorId,
        action: 'IMPORT_ROLLED_BACK',
        targetType: 'ImportBatch',
        targetId: batchId,
        detail: { removedRecords: createdKeys.length },
      },
      em,
    );
  });
  if (def.requiresTerm) await afterRollback(batch);
}

/** Lô đang chờ xác nhận nhưng đã có thao tác đang chạy → client tự làm mới. */
export function isBatchBusy(batch: Pick<ImportBatch, 'status' | 'summary'>): boolean {
  return (
    batch.status === ImportBatchStatus.UPLOADING ||
    batch.status === ImportBatchStatus.VALIDATING ||
    (batch.status === ImportBatchStatus.STAGED && Boolean(readSummary(batch.summary).confirmedAt))
  );
}

export async function countErrorRows(batchId: string): Promise<number> {
  return (await getDataSource()).getRepository(ImportErrorRow).countBy({ importBatchId: batchId });
}
