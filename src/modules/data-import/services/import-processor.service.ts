import { type EntityManager } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { ImportBatchFile } from '@/db/entities/import-batch-file.entity';
import { ImportBatch, type ImportWarning } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Term } from '@/db/entities/term.entity';
import { ImportBatchStatus } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { getStorage } from '@/lib/storage';
import { requestEvaluationAfterImport } from '@/modules/rule-engine/services/evaluation-run.service';
import { FileRejectedError, IMPORT_LIMITS } from '../parsing/errors';
import { type ImportFileKind } from '../parsing/file-sniff';
import { buildHeaderMap, type HeaderMap, missingColumns } from '../parsing/headers';
import { locateHeader, openRowSource, type RawRow, type RowSource } from '../parsing/row-reader';
import {
  type ImportTypeDefinition,
  type LoadResult,
  type RowError,
  type RowWarning,
} from '../types/definition';
import { getImportDefinition } from '../types/registry';
import { addToCard, buildCourseCards, type CardAccumulators } from './import-cards';
import {
  type ImportSummary,
  MAX_WARNINGS,
  readSummary,
  writeSummary,
  writeWarnings,
} from './import-summary';

const CHUNK_SIZE = 500;

/** Vị trí 1 dòng trong lô: file nào (thứ tự trong lô), dòng mấy. */
interface RowOrigin {
  file: number;
  rowNumber: number;
}

interface PendingRow extends RowOrigin {
  raw: Record<string, string>;
  value: unknown;
  warnings: RowWarning[];
}

interface ErrorRow extends RowOrigin {
  raw: Record<string, string>;
  error: RowError;
}

/** Số liệu từng file của lô (bảng từng file ở màn xem trước). */
interface FileStats {
  totalRows: number;
  successRows: number;
  errorRows: number;
  courseIds: Set<string>;
}

interface PassResult {
  columns: string[];
  totalRows: number;
  successRows: number;
  errorRows: number;
  preview: Record<string, string>[];
  /** Cảnh báo không chặn nạp của các dòng hợp lệ (tối đa MAX_WARNINGS). */
  warnings: ImportWarning[];
  load: LoadResult;
  /** Thẻ nhận diện học phần (cộng dồn cả lô) — chỉ loại học tập. */
  cards: CardAccumulators;
  /** Theo `fileOrder`. */
  files: Map<number, FileStats>;
}

function fileKindOf(fileName: string): ImportFileKind {
  return fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
}

function columnNames(map: HeaderMap): string[] {
  return map.original.map((header, i) => header || `cot_${i + 1}`);
}

function rawRecord(map: HeaderMap, row: RawRow): Record<string, string> {
  return Object.fromEntries(
    map.original.map((header, i) => [header || `cot_${i + 1}`, row.values[i] ?? '']),
  );
}

function canonicalRecord(map: HeaderMap, row: RawRow): Record<string, string> {
  return Object.fromEntries([...map.index].map(([name, i]) => [name, row.values[i] ?? '']));
}

async function assertTermOpen(
  em: EntityManager,
  batch: ImportBatch,
  def: ImportTypeDefinition<unknown>,
) {
  if (!def.requiresTerm) return;
  const term = batch.termId ? await em.findOneBy(Term, { termId: batch.termId }) : null;
  if (!term) throw new FileRejectedError('Chưa chọn học kỳ cho lô nhập.');
  if (term.closedAt)
    throw new FileRejectedError(`${term.termName} đã chốt, không nhận thêm dữ liệu.`);
}

/** File của lô theo thứ tự tải lên. */
async function batchFiles(batchId: string): Promise<ImportBatchFile[]> {
  return (await getDataSource()).getRepository(ImportBatchFile).find({
    where: { importBatchId: batchId },
    order: { fileOrder: 'ASC' },
  });
}

/**
 * Mở 1 file của lô và tìm dòng tiêu đề. Lỗi cả file ở lô nhiều file ghi kèm tên file (cả lô bị
 * từ chối — docs/rules/12). `maxRows` = số dòng còn lại của trần 50.000 dòng cả lô.
 */
async function openBatchFile(
  file: ImportBatchFile,
  def: ImportTypeDefinition<unknown>,
  maxRows: number,
  multi: boolean,
): Promise<{ source: RowSource; headerMap: HeaderMap }> {
  try {
    const source = await locateHeader(
      await openRowSource(
        fileKindOf(file.fileName),
        await getStorage().getStream(file.originalFilePath),
        maxRows,
      ),
      (headers) => missingColumns(buildHeaderMap(headers), def.requiredColumns).length === 0,
    );
    const headerMap = buildHeaderMap(source.headers);
    const missing = missingColumns(headerMap, def.requiredColumns);
    if (missing.length > 0) {
      throw new FileRejectedError(
        `File thiếu cột bắt buộc: ${missing.join(', ')}. Hãy dùng đúng file mẫu.`,
      );
    }
    return { source, headerMap };
  } catch (error) {
    if (multi && error instanceof FileRejectedError) {
      throw new FileRejectedError(`${file.fileName}: ${error.message}`);
    }
    throw error;
  }
}

function duplicateDetail(first: RowOrigin, current: RowOrigin, files: ImportBatchFile[]): string {
  if (first.file === current.file) return `Trùng với dòng ${first.rowNumber} trong cùng file.`;
  const name = files.find((f) => f.fileOrder === first.file)?.fileName ?? '';
  return `Trùng với dòng ${first.rowNumber} của file ${name}.`;
}

/**
 * 1 lượt đọc toàn bộ các file của lô theo thứ tự: chuẩn hóa → chống trùng trong cả lô → đối chiếu
 * dữ liệu nền theo lô 500 dòng → ghi dòng lỗi; khi `load = true` ghi luôn dữ liệu hợp lệ trong
 * CÙNG transaction của lô dòng.
 */
async function runPass(
  batch: ImportBatch,
  def: ImportTypeDefinition<unknown>,
  load: boolean,
): Promise<PassResult> {
  const dataSource = await getDataSource();
  await assertTermOpen(dataSource.manager, batch, def);
  const files = await batchFiles(batch.id);
  if (files.length === 0) throw new FileRejectedError('Lô nhập không có file nào.');
  const fileNameOf = new Map(files.map((f) => [f.fileOrder, f.fileName]));
  const multi = files.length > 1;

  const result: PassResult = {
    columns: [],
    totalRows: 0,
    successRows: 0,
    errorRows: 0,
    preview: [],
    warnings: [],
    load: { inserted: 0, updated: 0, unchanged: 0, createdKeys: [] },
    cards: new Map(),
    files: new Map(
      files.map((f) => [
        f.fileOrder,
        { totalRows: 0, successRows: 0, errorRows: 0, courseIds: new Set<string>() },
      ]),
    ),
  };
  const statsOf = (file: number) => result.files.get(file) as FileStats;
  const seenKeys = new Map<string, RowOrigin>();
  const consistentValues = new Map<string, string>();
  let pending: PendingRow[] = [];
  let errors: ErrorRow[] = [];

  const flush = async () => {
    const rows = pending;
    const rowErrors = errors;
    pending = [];
    errors = [];
    await dataSource.transaction(async (em) => {
      const refErrors = await def.checkReferences(
        rows.map((r) => r.value),
        em,
        batch,
        (i, warning) => rows[i]?.warnings.push(warning),
      );
      const valid = rows.filter((_, i) => !refErrors.has(i));
      for (const [i, error] of refErrors) {
        const row = rows[i];
        if (row) rowErrors.push({ file: row.file, rowNumber: row.rowNumber, raw: row.raw, error });
      }
      if (def.describe) {
        rows.forEach((row, i) => {
          const card = def.describe?.(row.value);
          if (!card) return;
          statsOf(row.file).courseIds.add(card.courseId);
          addToCard(result.cards, card, {
            valid: !refErrors.has(i),
            warned: row.warnings.length > 0,
          });
        });
      }
      if (rowErrors.length > 0) {
        await em.insert(
          ImportErrorRow,
          rowErrors.map((e) => ({
            importBatchId: batch.id,
            sourceRowNumber: e.rowNumber,
            sourceFileName: fileNameOf.get(e.file) ?? null,
            rawData: e.raw,
            errorReason: e.error.reason,
            errorDetail: e.error.detail.slice(0, 255),
          })),
        );
      }
      for (const e of rowErrors) statsOf(e.file).errorRows += 1;
      result.errorRows += rowErrors.length;
      result.successRows += valid.length;
      for (const row of valid) {
        statsOf(row.file).successRows += 1;
        if (result.preview.length < 5) result.preview.push(row.raw);
        for (const warning of row.warnings) {
          if (result.warnings.length < MAX_WARNINGS) {
            result.warnings.push({
              row: row.rowNumber,
              ...(multi ? { file: fileNameOf.get(row.file) } : {}),
              ...warning,
            });
          }
        }
      }
      if (load && valid.length > 0) {
        const loaded = await def.load(
          valid.map((r) => r.value),
          em,
          batch,
        );
        result.load.inserted += loaded.inserted;
        result.load.updated += loaded.updated;
        result.load.unchanged += loaded.unchanged;
        result.load.createdKeys.push(...loaded.createdKeys);
      }
    });
  };

  for (const file of files) {
    const { source, headerMap } = await openBatchFile(
      file,
      def,
      IMPORT_LIMITS.maxDataRows - result.totalRows,
      multi,
    );
    for (const column of columnNames(headerMap)) {
      if (!result.columns.includes(column)) result.columns.push(column);
    }
    for await (const row of source.rows) {
      result.totalRows += 1;
      statsOf(file.fileOrder).totalRows += 1;
      const origin = { file: file.fileOrder, rowNumber: row.rowNumber };
      const raw = rawRecord(headerMap, row);
      const parsed = def.parseRow(canonicalRecord(headerMap, row), {
        decimalComma: source.decimalComma,
      });
      if (!parsed.ok) {
        errors.push({ ...origin, raw, error: parsed });
      } else {
        const duplicateOf = def
          .uniqueKeys(parsed.value)
          .map((k) => seenKeys.get(k))
          .find((n) => n !== undefined);
        const consistency = def.consistency?.(parsed.value);
        const firstValue = consistency ? consistentValues.get(consistency.key) : undefined;
        if (duplicateOf !== undefined) {
          errors.push({
            ...origin,
            raw,
            error: { reason: 'DUPLICATE', detail: duplicateDetail(duplicateOf, origin, files) },
          });
        } else if (consistency && firstValue !== undefined && firstValue !== consistency.value) {
          errors.push({
            ...origin,
            raw,
            error: { reason: 'INVALID_FORMAT', detail: consistency.message },
          });
        } else {
          if (consistency) consistentValues.set(consistency.key, consistency.value);
          for (const key of def.uniqueKeys(parsed.value)) seenKeys.set(key, origin);
          pending.push({ ...origin, raw, value: parsed.value, warnings: parsed.warnings ?? [] });
        }
      }
      if (pending.length + errors.length >= CHUNK_SIZE) await flush();
    }
  }
  if (pending.length + errors.length > 0) await flush();
  return result;
}

/** Ghi số liệu từng file sau mỗi lượt đọc. */
async function saveFileStats(em: EntityManager, batchId: string, pass: PassResult) {
  for (const [fileOrder, stats] of pass.files) {
    await em.update(
      ImportBatchFile,
      { importBatchId: batchId, fileOrder },
      {
        totalRows: stats.totalRows,
        successRows: stats.successRows,
        errorRows: stats.errorRows,
        courseIds: [...stats.courseIds].sort().slice(0, 50),
      },
    );
  }
}

async function rejectBatch(batchId: string, message: string): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    await em.update(
      ImportBatch,
      { id: batchId },
      {
        status: ImportBatchStatus.REJECTED,
        errorMessage: message,
        completedAt: new Date(),
      },
    );
    await writeAuditLog(
      {
        actorId: null,
        action: 'IMPORT_REJECTED',
        targetType: 'ImportBatch',
        targetId: batchId,
        detail: { message },
      },
      em,
    );
  });
}

function requireDefinition(batch: ImportBatch): ImportTypeDefinition<unknown> {
  const def = getImportDefinition(batch.dataType);
  if (!def) throw new Error(`Loại nhập ${batch.dataType} chưa được hỗ trợ`);
  return def;
}

/** Bước 1 — kiểm tra (VALIDATING → STAGED / REJECTED). Không ghi dữ liệu nghiệp vụ. Idempotent. */
export async function validateImportBatch(batchId: string): Promise<void> {
  const dataSource = await getDataSource();
  const batch = await dataSource.getRepository(ImportBatch).findOneBy({ id: batchId });
  if (!batch || batch.status !== ImportBatchStatus.VALIDATING) return;
  await dataSource.getRepository(ImportErrorRow).delete({ importBatchId: batchId });

  try {
    const pass = await runPass(batch, requireDefinition(batch), false);
    await saveFileStats(dataSource.manager, batchId, pass);
    if (pass.successRows === 0) {
      await dataSource.getRepository(ImportBatch).update(batchId, {
        totalRows: pass.totalRows,
        successRows: 0,
        errorRows: pass.errorRows,
      });
      await rejectBatch(
        batchId,
        pass.totalRows === 0
          ? 'File không có dòng dữ liệu nào.'
          : 'Không có dòng hợp lệ nào — tải file lỗi để sửa.',
      );
      return;
    }
    const summary: ImportSummary = {
      columns: pass.columns,
      preview: pass.preview,
      errorRate: pass.totalRows === 0 ? 0 : pass.errorRows / pass.totalRows,
      courses: await buildCourseCards(dataSource.manager, batch, pass.cards),
    };
    await dataSource.getRepository(ImportBatch).update(batchId, {
      status: ImportBatchStatus.STAGED,
      totalRows: pass.totalRows,
      successRows: pass.successRows,
      errorRows: pass.errorRows,
      warnings: writeWarnings(pass.warnings),
      summary: writeSummary(summary),
      stagedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof FileRejectedError) return rejectBatch(batchId, error.message);
    throw error;
  }
}

/** Khóa nạp theo (loại, học kỳ) — lô thứ hai cùng loại, cùng học kỳ chờ lô đầu (docs/rules/12). */
async function withImportLock<T>(batch: ImportBatch, run: () => Promise<T>): Promise<T> {
  const runner = (await getDataSource()).createQueryRunner();
  const key = `import:${batch.dataType}:${batch.termId ?? '-'}`;
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
    return await run();
  } finally {
    await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => undefined);
    await runner.release();
  }
}

/**
 * Bước 2 — sau khi Admin xác nhận: KIỂM TRA LẠI toàn bộ với dữ liệu nền hiện tại rồi ghi
 * (STAGED đã xác nhận → LOADED → RECONCILED). `retried` = job đang chạy lại sau lỗi.
 */
export async function loadImportBatch(
  batchId: string,
  options: {
    retried: boolean;
    /** Sau khi lô học tập RECONCILED: đánh giá lại học kỳ (mặc định tạo EvaluationRun tự động). */
    afterReconciled?: (batch: ImportBatch) => Promise<unknown>;
  },
): Promise<void> {
  const dataSource = await getDataSource();
  const repo = dataSource.getRepository(ImportBatch);
  const initial = await repo.findOneBy({ id: batchId });
  if (!initial || initial.status !== ImportBatchStatus.STAGED) return;
  const confirmed = readSummary(initial.summary);
  if (!confirmed.confirmedAt) return;

  await withImportLock(initial, async () => {
    const batch = await repo.findOneByOrFail({ id: batchId });
    if (batch.status !== ImportBatchStatus.STAGED) return;
    await dataSource.getRepository(ImportErrorRow).delete({ importBatchId: batchId });
    try {
      const pass = await runPass(batch, requireDefinition(batch), true);
      const summary: ImportSummary = {
        ...readSummary(batch.summary),
        columns: pass.columns,
        retried: options.retried || undefined,
        inserted: pass.load.inserted,
        updated: pass.load.updated,
        unchanged: pass.load.unchanged,
        createdKeys: pass.load.createdKeys,
      };
      const now = new Date();
      await dataSource.transaction(async (em) => {
        await saveFileStats(em, batchId, pass);
        await em.update(
          ImportBatch,
          { id: batchId },
          {
            status: ImportBatchStatus.LOADED,
            totalRows: pass.totalRows,
            successRows: pass.successRows,
            errorRows: pass.errorRows,
            warnings: writeWarnings(pass.warnings),
            summary: writeSummary(summary),
            loadedAt: now,
          },
        );
        // Dữ liệu dẫn xuất (Course.credits, attemptOutcome, enrollmentStatus, attemptNumber) đã cập
        // nhật trong CÙNG transaction với từng lô dòng (docs/rules/10) → lô đã đối soát.
        await em.update(
          ImportBatch,
          { id: batchId },
          { status: ImportBatchStatus.RECONCILED, completedAt: now },
        );
        await writeAuditLog(
          {
            actorId: summary.confirmedBy ?? null,
            action: 'IMPORT_LOADED',
            targetType: 'ImportBatch',
            targetId: batchId,
            detail: {
              inserted: summary.inserted,
              updated: summary.updated,
              errorRows: pass.errorRows,
            },
          },
          em,
        );
      });
      // Sau commit: lô dữ liệu học tập → EvaluationRun AUTO_AFTER_IMPORT (docs/rules/08).
      if (requireDefinition(batch).requiresTerm) {
        await (options.afterReconciled ?? requestEvaluationAfterImport)(batch);
      }
    } catch (error) {
      if (error instanceof FileRejectedError) return rejectBatch(batchId, error.message);
      throw error;
    }
  });
}

/** Job lỗi hết số lần thử → đánh dấu lô bị từ chối thay vì treo mãi (docs/rules/01). */
export async function failImportBatch(batchId: string, reason: string): Promise<void> {
  logger.error({ batchId, reason }, 'lô nhập lỗi hệ thống');
  const repo = (await getDataSource()).getRepository(ImportBatch);
  const batch = await repo.findOneBy({ id: batchId });
  if (!batch) return;
  if (batch.status === ImportBatchStatus.VALIDATING || batch.status === ImportBatchStatus.STAGED) {
    await rejectBatch(batchId, 'Lỗi hệ thống khi xử lý file. Vui lòng thử nạp lại.');
  }
}
