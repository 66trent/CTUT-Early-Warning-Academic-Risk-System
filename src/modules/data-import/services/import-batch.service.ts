import { createHash, randomUUID } from 'node:crypto';
import { type EntityManager, In, LessThan, MoreThan, IsNull, Not } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Course } from '@/db/entities/course.entity';
import { ImportBatchFile } from '@/db/entities/import-batch-file.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Term } from '@/db/entities/term.entity';
import { ImportBatchStatus, ImportSource } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { requestAutoEvaluation } from '@/modules/rule-engine/services/evaluation-run.service';
import { FileRejectedError, IMPORT_LIMITS } from '../parsing/errors';
import { sniffImportFile } from '../parsing/file-sniff';
import { getImportDefinition } from '../types/registry';
import { type ImportEnqueuer, enqueueImportJob } from './import-queue';
import { readSummary, writeSummary } from './import-summary';

export const STAGED_TTL_DAYS = 7;
/** Lô tải lên dở (trình duyệt đóng giữa chừng) quá thời gian này → tự hủy. */
export const UPLOADING_TTL_HOURS = 24;
const LIVE_STATUSES = [
  ImportBatchStatus.UPLOADING,
  ImportBatchStatus.VALIDATING,
  ImportBatchStatus.STAGED,
  ImportBatchStatus.LOADED,
  ImportBatchStatus.RECONCILED,
];

export interface ImportFileInput {
  fileName: string;
  data: Buffer;
}

/** Thông tin chung của lô — mọi file trong lô cùng loại, cùng học kỳ (docs/rules/12). */
export interface ImportBatchMeta {
  dataType: string;
  termId: string | null;
  /** Học phần Admin chọn (tùy chọn) — dòng thuộc học phần khác → `COURSE_MISMATCH`. */
  courseId?: string | null;
  parentBatchId: string | null;
}

/** Lô 1 file (`fileName` + `data`) hoặc nhiều file (`files`). */
export type CreateImportInput = ImportBatchMeta &
  ({ fileName: string; data: Buffer } | { files: ImportFileInput[] });

function safeObjectName(fileName: string): string {
  const base = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_');
  return base.slice(-100) || 'file';
}

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

const tooManyFiles = () =>
  new AppError(
    'TOO_MANY_FILES',
    `Mỗi lần nạp tối đa ${IMPORT_LIMITS.maxFilesPerBatch} file. Hãy chia thành nhiều lần.`,
  );

/** Kiểm tra loại, học kỳ (chưa chốt), học phần chọn trên form. */
async function resolveMeta(meta: ImportBatchMeta) {
  const def = getImportDefinition(meta.dataType);
  if (!def) throw new AppError('INVALID_TYPE', 'Loại dữ liệu chưa được hỗ trợ.');
  const dataSource = await getDataSource();
  const termId = def.requiresTerm ? meta.termId : null;
  if (def.requiresTerm) {
    const term = termId ? await dataSource.getRepository(Term).findOneBy({ termId }) : null;
    if (!term) throw new AppError('TERM_REQUIRED', 'Chọn học kỳ cho dữ liệu này.');
    if (term.closedAt)
      throw new AppError('TERM_CLOSED', `${term.termName} đã chốt, không nhận thêm dữ liệu.`);
  }
  const courseId = def.requiresTerm ? (meta.courseId ?? null) : null;
  if (courseId && !(await dataSource.getRepository(Course).existsBy({ courseId }))) {
    throw new AppError('COURSE_NOT_FOUND', `Chưa có học phần ${courseId} trong hệ thống.`);
  }
  return { termId, courseId };
}

/** Kiểm tra file (đuôi + nội dung + dung lượng) và trả checksum. */
function checkFile(file: ImportFileInput): string {
  try {
    sniffImportFile(file.fileName, file.data);
  } catch (error) {
    if (error instanceof FileRejectedError) throw new AppError('FILE_REJECTED', error.message);
    throw error;
  }
  return sha256(file.data);
}

/** Chống nạp trùng TỪNG file: file đã nằm trong 1 lô còn hiệu lực cùng loại, cùng học kỳ. */
async function assertFileNotLoaded(
  em: EntityManager,
  checksum: string,
  batch: { dataType: string; termId: string | null },
  fileName: string,
): Promise<void> {
  const duplicate = await em
    .createQueryBuilder(ImportBatchFile, 'f')
    .innerJoin(ImportBatch, 'b', 'b.id = f.import_batch_id')
    .where('f.source_checksum = :checksum', { checksum })
    .andWhere('b.data_type = :dataType', { dataType: batch.dataType })
    .andWhere("COALESCE(b.term_id, '') = :termId", { termId: batch.termId ?? '' })
    .andWhere('b.status IN (:...live)', { live: LIVE_STATUSES })
    .getExists();
  if (duplicate) {
    throw new AppError(
      'DUPLICATE_FILE',
      `File ${fileName} đã được nạp trước đó. Nếu cần nạp lại, hãy hủy hoặc hoàn tác lô cũ.`,
    );
  }
}

async function storeFile(batchId: string, order: number, file: ImportFileInput): Promise<string> {
  const year = new Date().getFullYear();
  const objectKey = `imports/${year}/${batchId}/${order}-${safeObjectName(file.fileName)}`;
  await getStorage().put(objectKey, file.data, 'application/octet-stream');
  return objectKey;
}

/**
 * Tải lên — bước 1: tạo lô `UPLOADING` với file đầu tiên (docs/rules/12). Lô nhiều file: trình
 * duyệt gửi tiếp từng file (`addImportFile`) rồi `finishImportUpload` (Server Action ≤ 21MB/lần).
 */
export async function beginImportUpload(
  meta: ImportBatchMeta,
  file: ImportFileInput,
  actorId: string,
): Promise<{ batchId: string }> {
  const { termId, courseId } = await resolveMeta(meta);
  const checksum = checkFile(file);
  const dataSource = await getDataSource();
  const scope = { dataType: meta.dataType, termId };
  await assertFileNotLoaded(dataSource.manager, checksum, scope, file.fileName);

  const id = randomUUID();
  const objectKey = await storeFile(id, 1, file);
  const fileName = file.fileName.slice(0, 255);
  await dataSource.transaction(async (em) => {
    await em.insert(ImportBatch, {
      id,
      dataType: meta.dataType,
      termId,
      courseId,
      source: ImportSource.FILE,
      fileName,
      sourceChecksum: checksum,
      performedBy: actorId,
      status: ImportBatchStatus.UPLOADING,
      parentBatchId: meta.parentBatchId,
      originalFilePath: objectKey,
    });
    await em.insert(ImportBatchFile, {
      importBatchId: id,
      fileOrder: 1,
      fileName,
      sourceChecksum: checksum,
      originalFilePath: objectKey,
      sizeBytes: file.data.length,
    });
  });
  return { batchId: id };
}

/** Khóa lô đang tải lên của chính người gọi. */
async function lockUploading(
  em: EntityManager,
  batchId: string,
  actorId: string,
): Promise<ImportBatch> {
  const batch = await em.findOne(ImportBatch, {
    where: { id: batchId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!batch) throw new AppError('BATCH_NOT_FOUND', 'Không tìm thấy lô nhập.');
  if (batch.status !== ImportBatchStatus.UPLOADING || batch.performedBy !== actorId) {
    throw new AppError('INVALID_STATUS', 'Lô không còn nhận thêm file.');
  }
  return batch;
}

/** Tải lên — thêm 1 file vào lô `UPLOADING` (≤ 50 file, không trùng tên / nội dung trong lô). */
export async function addImportFile(
  batchId: string,
  file: ImportFileInput,
  actorId: string,
): Promise<void> {
  const checksum = checkFile(file);
  const name = file.fileName.slice(0, 255);
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const batch = await lockUploading(em, batchId, actorId);
    const files = await em.find(ImportBatchFile, {
      select: { fileOrder: true, fileName: true, sourceChecksum: true },
      where: { importBatchId: batchId },
    });
    if (files.length >= IMPORT_LIMITS.maxFilesPerBatch) throw tooManyFiles();
    if (files.some((f) => f.fileName === name)) {
      throw new AppError('DUPLICATE_FILE', `Đã chọn 2 file cùng tên ${name}. Hãy đổi tên 1 file.`);
    }
    if (files.some((f) => f.sourceChecksum === checksum)) {
      throw new AppError(
        'DUPLICATE_FILE',
        `File ${name} trùng nội dung với 1 file khác trong lần nạp này.`,
      );
    }
    await assertFileNotLoaded(em, checksum, batch, name);
    const order = Math.max(0, ...files.map((f) => f.fileOrder)) + 1;
    await em.insert(ImportBatchFile, {
      importBatchId: batchId,
      fileOrder: order,
      fileName: name,
      sourceChecksum: checksum,
      originalFilePath: await storeFile(batchId, order, file),
      sizeBytes: file.data.length,
    });
  });
}

/** Tải lên — kết thúc: lô → `VALIDATING` + job kiểm tra. Nhiều file: checksum = băm các checksum. */
export async function finishImportUpload(
  batchId: string,
  actorId: string,
  enqueue: ImportEnqueuer = enqueueImportJob,
): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const batch = await lockUploading(em, batchId, actorId);
    const files = await em.find(ImportBatchFile, {
      select: { fileName: true, sourceChecksum: true },
      where: { importBatchId: batchId },
      order: { fileOrder: 'ASC' },
    });
    const checksum =
      files.length === 1
        ? batch.sourceChecksum
        : sha256(
            files
              .map((f) => f.sourceChecksum)
              .sort()
              .join(','),
          );
    await em.update(
      ImportBatch,
      { id: batchId },
      { status: ImportBatchStatus.VALIDATING, sourceChecksum: checksum },
    );
    await writeAuditLog(
      {
        actorId,
        action: 'IMPORT_CREATED',
        targetType: 'ImportBatch',
        targetId: batchId,
        detail: {
          dataType: batch.dataType,
          termId: batch.termId,
          fileName: batch.fileName,
          fileCount: files.length,
          ...(files.length > 1 ? { fileNames: files.map((f) => f.fileName) } : {}),
          parentBatchId: batch.parentBatchId,
        },
      },
      em,
    );
  });
  await enqueue('validate', batchId);
}

/**
 * Tạo lô trong 1 lần gọi (script, test): tải lên từng file → kết thúc. Lỗi cả file báo ngay; lỗi
 * ở file thứ 2 trở đi → hủy lô đang tải lên.
 */
export async function createImportBatch(
  input: CreateImportInput,
  actorId: string,
  enqueue: ImportEnqueuer = enqueueImportJob,
): Promise<{ batchId: string }> {
  const files = 'files' in input ? input.files : [{ fileName: input.fileName, data: input.data }];
  const [first, ...rest] = files;
  if (!first) throw new AppError('INVALID_INPUT', 'Chọn file cần nạp.');
  if (files.length > IMPORT_LIMITS.maxFilesPerBatch) throw tooManyFiles();
  const { batchId } = await beginImportUpload(input, first, actorId);
  try {
    for (const file of rest) await addImportFile(batchId, file, actorId);
    await finishImportUpload(batchId, actorId, enqueue);
  } catch (error) {
    await discardImportBatch(batchId, actorId).catch(() => undefined);
    throw error;
  }
  return { batchId };
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

/** Lô hủy được: đang tải lên, hoặc chờ xác nhận mà chưa xác nhận (chưa ghi dữ liệu nghiệp vụ). */
function isDiscardable(batch: Pick<ImportBatch, 'status' | 'summary'>): boolean {
  return (
    batch.status === ImportBatchStatus.UPLOADING ||
    (batch.status === ImportBatchStatus.STAGED && !readSummary(batch.summary).confirmedAt)
  );
}

/** Hủy lô đang tải lên / chờ xác nhận (chưa ghi dữ liệu nghiệp vụ nào). */
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
    if (!isDiscardable(batch)) {
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

/**
 * Tự hủy lô chờ xác nhận quá 7 ngày và lô tải lên dở quá 1 ngày (job hằng ngày). Trả số lô đã hủy.
 */
export async function expireStagedBatches(now = new Date()): Promise<number> {
  const stagedCutoff = new Date(now.getTime() - STAGED_TTL_DAYS * 24 * 3600 * 1000);
  const uploadingCutoff = new Date(now.getTime() - UPLOADING_TTL_HOURS * 3600 * 1000);
  const stale = await (await getDataSource()).getRepository(ImportBatch).find({
    select: { id: true, status: true, summary: true },
    where: [
      { status: ImportBatchStatus.STAGED, stagedAt: LessThan(stagedCutoff) },
      { status: ImportBatchStatus.UPLOADING, createdAt: LessThan(uploadingCutoff) },
    ],
    take: 500,
  });
  let expired = 0;
  for (const batch of stale) {
    if (!isDiscardable(batch)) continue;
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
