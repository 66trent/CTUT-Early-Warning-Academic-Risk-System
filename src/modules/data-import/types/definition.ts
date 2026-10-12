import { type EntityManager } from 'typeorm';
import { type ImportBatch } from '@/db/entities/import-batch.entity';
import { type ImportDataType, type ImportErrorReason } from '@/db/enums';

/** Lỗi 1 dòng — `detail` là diễn giải tiếng Việt cụ thể cho người nhập. */
export interface RowError {
  reason: ImportErrorReason;
  detail: string;
}

/** Cảnh báo không chặn nạp (VD điểm chữ lệch điểm tổng kết) — ghi vào `ImportBatch.warnings`. */
export interface RowWarning {
  code: string;
  message: string;
}

export type ParsedRow<T> =
  { ok: true; value: T; warnings?: RowWarning[] } | ({ ok: false } & RowError);

export interface ParseOptions {
  decimalComma: boolean;
}

export interface LoadResult {
  inserted: number;
  updated: number;
  unchanged: number;
  /** Khóa nghiệp vụ các bản ghi lô này TẠO MỚI — dùng cho hoàn tác lô. */
  createdKeys: string[];
}

/**
 * Định nghĩa 1 loại nhập (docs/rules/12). Mỗi loại 1 file, đăng ký vào registry — khung nhập
 * (đọc file, chia lô 500 dòng, ghi lỗi, trạng thái lô) dùng chung, không if/else theo loại.
 */
export interface ImportTypeDefinition<T> {
  dataType: ImportDataType;
  /** Tên hiển thị cho người dùng. */
  label: string;
  requiresTerm: boolean;
  requiredColumns: readonly string[];
  optionalColumns: readonly string[];
  /** Đường dẫn file mẫu trong `public/`. */
  templatePath: string;
  /** Chuẩn hóa + kiểm tra định dạng 1 dòng (thuần, không DB). */
  parseRow(record: Readonly<Record<string, string>>, options: ParseOptions): ParsedRow<T>;
  /** Khóa chống trùng trong CÙNG file (VD mssv, email). */
  uniqueKeys(row: T): string[];
  /** Đối chiếu dữ liệu nền theo lô dòng; trả lỗi theo vị trí trong mảng. */
  checkReferences(
    rows: readonly T[],
    em: EntityManager,
    batch: ImportBatch,
  ): Promise<Map<number, RowError>>;
  /** Ghi các dòng hợp lệ (upsert theo khóa nghiệp vụ) trong transaction `em`. */
  load(rows: readonly T[], em: EntityManager, batch: ImportBatch): Promise<LoadResult>;
  /**
   * Hoàn tác lô (docs/rules/12): xóa đúng các bản ghi lô đã tạo.
   * Trả lý do không hoàn tác được (VD sinh viên đã đăng nhập), hoặc null nếu đã xóa xong.
   */
  rollback(
    createdKeys: readonly string[],
    em: EntityManager,
    batch: ImportBatch,
  ): Promise<string | null>;
}
